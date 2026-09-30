/**
 * 游戏纠错编辑器前端
 *
 * 数据视角：左侧原始名来自 data/<uid>/*.record.json 里实际出现过的 playGame，
 * 右边编辑的是 data/SpellingCorrections.json 的 uidRules[uid].rules。
 *
 * 保存模型与其余两个页面一致：整个 uid 的 rules 数组是一个保存单元
 *   - 防抖 800ms 触发，输入框失焦立即触发
 *   - 保存中产生的修改会在本次完成后合并提交
 *
 * 注意 rules 里含「数据中没出现过的孤儿规则」，它们不渲染成行，但会原样回写——
 * 保存基线是整个 rules 数组，不是表格里看得到的那部分。
 */

const SAVE_DEBOUNCE_MS = 800;
const SEARCH_DEBOUNCE_MS = 200;

/** finalSource → 标签文案 */
const SOURCE_LABEL = {
	none: '无',
	uid: '当前',
	global: '全局',
	'uid+global': '当前+全局'
};

const state = {
	/** 可用用户列表：只含存在 *.record.json 的 uid */
	users: [],
	uid: '',
	/** 聚合结果，来自 GET /api/games/:uid，顺序即展示顺序 */
	games: [],
	/** 当前 uid 的完整规则（含孤儿），保存基线 */
	rules: [],
	/** 全局规则 from → to，用于就地重算最终结果 */
	globalRules: {},
	searchKeyword: '',
	save: {
		isSaving: false,
		pending: false,
		timer: null,
		/** 正在进行的那次提交，供「切换 uid 前等队列清空」等待 */
		running: null,
		savedSnapshot: '[]',
		error: null,
		notice: '',
		pendingNotice: ''
	},
	/** 正在执行提升的 rawName，用于禁用按钮 */
	promoting: '',
	/** rawName → 行内错误文案 */
	rowErrors: {}
};

/** 渲染时缓存的单元格引用：编辑时只更新本行，重绘整表会把焦点弄丢 */
const rowCells = new Map();

// ==================== 规则模型 ====================

/** 当前 uid 规则中 from 对应的 to；没有则返回 null */
function ruleTo( from ) {
	for ( const rule of state.rules ) {
		if ( rule.from === from ) return rule.to;
	}

	return null;
}

/**
 * 修改当前 uid 的规则模型：空串表示删除该条
 * 就地替换而不是先删后推，避免文件里的规则顺序被编辑动作打乱
 */
function applyRule( from, value ) {
	const to = value.trim();
	const index = state.rules.findIndex( rule => rule.from === from );

	if ( to === '' ) {
		if ( index !== -1 ) state.rules.splice( index, 1 );
		return;
	}

	if ( index === -1 ) {
		state.rules.push( { from, to } );
	} else {
		state.rules[ index ] = { from, to };
	}
}

// ==================== 链式计算 ====================
//
// 必须与后端 gamesAggregator.ts 以及主程序 SpellingCorrection.correct() 保持一致：
//   1. 用原始名查 UID 规则，命中则替换
//   2. 用**第 1 步的结果**查全局规则，命中则再替换
// 所以 uid 命中并不代表终止，全局规则仍可能改写它——这正是「当前+全局」标签的来历。

function hasOwn( object, key ) {
	return Object.prototype.hasOwnProperty.call( object, key );
}

/** 算出某个原始名当前的链式纠错结果 */
function resolve( rawName ) {
	const uidTo = ruleTo( rawName );
	// 第一步：UID 规则，未命中则保持原名
	const step1 = uidTo === null ? rawName : uidTo;
	// 第二步：用中间结果查全局规则
	const globalTo = hasOwn( state.globalRules, step1 ) ? state.globalRules[ step1 ] : null;

	// 被 uid 规则挡住的全局值：全局对「原始名」的匹配结果，仅在 uid 确实改了名字时有意义
	const shadowedGlobalTo = uidTo !== null && step1 !== rawName && hasOwn( state.globalRules, rawName )
		? state.globalRules[ rawName ]
		: null;

	let finalSource = 'none';
	if ( uidTo !== null && globalTo !== null ) {
		finalSource = 'uid+global';
	} else if ( uidTo !== null ) {
		finalSource = 'uid';
	} else if ( globalTo !== null ) {
		finalSource = 'global';
	}

	return {
		uidTo,
		step1,
		globalTo,
		shadowedGlobalTo,
		finalName: globalTo === null ? step1 : globalTo,
		finalSource
	};
}

// ==================== 保存 ====================

function scheduleSave() {
	const save = state.save;
	clearTimeout( save.timer );
	save.timer = setTimeout( () => {
		save.timer = null;
		flush();
	}, SAVE_DEBOUNCE_MS );

	// 新的编辑动作意味着上一次的结果提示已经过时
	save.notice = '';
	renderStatus();
}

/**
 * 提交修改；保存中再次触发会被合并到本次之后
 * 返回的 Promise 在队列排空（没有进行中的提交、也没有待补交的修改）后 resolve
 */
async function flush() {
	const save = state.save;
	clearTimeout( save.timer );
	save.timer = null;

	if ( !state.uid ) return;

	if ( save.isSaving ) {
		save.pending = true;
		return save.running;
	}

	const snapshot = JSON.stringify( state.rules );
	if ( snapshot === save.savedSnapshot ) {
		renderStatus();
		return;
	}

	save.isSaving = true;
	renderStatus();

	save.running = ( async () => {
		try {
			await putRules( state.uid, state.rules );
			save.savedSnapshot = snapshot;
			save.error = null;

			if ( save.pendingNotice ) {
				save.notice = save.pendingNotice;
				save.pendingNotice = '';
				render();
			}
		} catch ( error ) {
			save.error = error.message;
			save.pendingNotice = '';
		} finally {
			save.isSaving = false;
		}

		renderStatus();
	} )();

	await save.running;

	// 保存期间的修改：本次成功后立即补交，失败则等用户重试
	if ( save.pending ) {
		save.pending = false;
		if ( !save.error ) {
			await flush();
		}
	}
}

async function putRules( uid, rules ) {
	let response;
	try {
		response = await fetch( `/api/spelling/uid/${ encodeURIComponent( uid ) }`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( { rules } )
		} );
	} catch ( error ) {
		throw new Error( '无法连接到本地服务，请确认 npm run edit 仍在运行' );
	}

	await readResult( response );
}

/**
 * 请求提升到全局
 * 冲突时抛出的 Error 上带 conflictTo，供调用方拼 confirm 文案
 */
async function postPromote( uid, from, to, overwrite ) {
	let response;
	try {
		response = await fetch( '/api/spelling/promote-to-global', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( { uid, from, to, overwrite } )
		} );
	} catch ( error ) {
		throw new Error( '无法连接到本地服务，请确认 npm run edit 仍在运行' );
	}

	return readResult( response );
}

/** 解析统一响应格式，失败时抛出带 message（以及可能存在的 conflictTo）的 Error */
async function readResult( response ) {
	let data = null;
	try {
		data = await response.json();
	} catch ( error ) {
		// 响应体不是 JSON，下面按状态码兜底报错
	}

	if ( !response.ok || !data || data.success !== true ) {
		const failure = new Error( ( data && data.message ) || `请求失败（HTTP ${response.status}）` );

		if ( data && data.error === 'GLOBAL_RULE_CONFLICT' && typeof data.existingTo === 'string' ) {
			failure.conflictTo = data.existingTo;
		}

		throw failure;
	}

	return data;
}

// ==================== 编辑动作 ====================

/**
 * 把某行的规则提升为全局
 * 移动语义：成功后本地同步为「uid 规则少一条、全局多一条」，不需要回后端重新拉取
 */
async function promote( rawName ) {
	const to = ruleTo( rawName );
	if ( to === null || state.promoting ) return;

	state.rowErrors[ rawName ] = '';
	state.promoting = rawName;
	render();

	// 后端要求这条规则已经在 uid 规则里，先把保存队列排空
	await flush();

	try {
		try {
			await postPromote( state.uid, rawName, to, false );
		} catch ( error ) {
			if ( error.conflictTo === undefined ) throw error;

			const overwrite = window.confirm(
				`全局规则已存在「${rawName} → ${error.conflictTo}」，是否覆盖为「${rawName} → ${to}」？`
			);

			if ( !overwrite ) {
				state.promoting = '';
				render();
				return;
			}

			await postPromote( state.uid, rawName, to, true );
		}
	} catch ( error ) {
		state.rowErrors[ rawName ] = error.message;
		state.promoting = '';
		render();
		return;
	}

	// 成功：把这条规则从 uid 移到全局
	state.rules = state.rules.filter( rule => rule.from !== rawName );
	state.globalRules[ rawName ] = to;
	state.save.savedSnapshot = JSON.stringify( state.rules );
	state.save.notice = `已把「${rawName} → ${to}」添加到全局规则`;
	state.promoting = '';
	render();
	renderStatus();
}

// ==================== 渲染 ====================

function render() {
	const app = document.getElementById( 'app' );
	app.textContent = '';
	rowCells.clear();

	if ( state.users.length === 0 ) {
		app.appendChild( placeholder( 'data/ 下还没有任何 *.record.json，先去跑一次 npm run start。' ) );
		return;
	}

	const card = document.createElement( 'section' );
	card.className = 'card';
	card.appendChild( renderHeader() );

	if ( state.save.notice ) {
		const notice = document.createElement( 'p' );
		notice.className = 'card__notice';
		notice.textContent = state.save.notice;
		card.appendChild( notice );
	}

	if ( state.save.error ) {
		const errorBox = document.createElement( 'p' );
		errorBox.className = 'card__error';
		errorBox.textContent = `保存失败：${state.save.error}`;
		card.appendChild( errorBox );
	}

	if ( state.games === null ) {
		card.appendChild( placeholder( `正在加载 UID ${state.uid} 的游戏名…` ) );
		app.appendChild( card );
		return;
	}

	card.appendChild( renderTable() );
	app.appendChild( card );
}

function renderHeader() {
	const header = document.createElement( 'div' );
	header.className = 'card__header';

	const titleBox = document.createElement( 'div' );
	const titleEl = document.createElement( 'h2' );
	titleEl.className = 'card__title';
	titleEl.textContent = state.uid ? `UID ${state.uid}` : '未选择用户';

	const subtitleEl = document.createElement( 'p' );
	subtitleEl.className = 'card__subtitle';
	subtitleEl.textContent = state.games === null
		? '加载中…'
		: `${state.games.length} 个游戏名 · ${state.rules.length} 条专属规则`;

	titleBox.append( titleEl, subtitleEl );

	const select = document.createElement( 'select' );
	select.className = 'select';
	select.id = 'user-select';
	select.setAttribute( 'aria-label', '选择用户' );

	for ( const user of state.users ) {
		const option = document.createElement( 'option' );
		option.value = user.uid;
		option.textContent = `UID ${user.uid}`;
		option.selected = user.uid === state.uid;
		select.appendChild( option );
	}

	select.addEventListener( 'change', () => selectUser( select.value ) );

	header.append( titleBox, select );
	return header;
}

function renderTable() {
	const scroll = document.createElement( 'div' );
	scroll.className = 'card__scroll';

	const table = document.createElement( 'table' );
	table.className = 'table table--games';

	const head = document.createElement( 'thead' );
	const headRow = document.createElement( 'tr' );
	for ( const [ text, className ] of [
		[ '原始游戏名', 'col-raw' ],
		[ '纠正后名称', 'col-rule' ],
		[ '当前最终结果', 'col-final' ],
		[ '操作', 'col-promote' ]
	] ) {
		const th = document.createElement( 'th' );
		th.className = className;
		th.textContent = text;
		headRow.appendChild( th );
	}
	head.appendChild( headRow );
	table.appendChild( head );

	const body = document.createElement( 'tbody' );
	let visible = 0;

	for ( const game of state.games ) {
		if ( !matchesSearch( game ) ) continue;
		visible++;
		body.appendChild( renderRow( game ) );
	}

	if ( visible === 0 ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.className = 'table__empty';
		cell.colSpan = 4;
		cell.textContent = state.games.length === 0
			? '这个 UID 的录播数据里还没有解析出游戏名。'
			: '没有匹配的游戏名。';
		row.appendChild( cell );
		body.appendChild( row );
	}

	table.appendChild( body );
	scroll.appendChild( table );
	return scroll;
}

function renderRow( game ) {
	const { rawName } = game;
	const row = document.createElement( 'tr' );

	// 原始名 + 出现次数
	const rawCell = document.createElement( 'td' );
	rawCell.className = 'col-raw';
	const rawBox = document.createElement( 'div' );
	rawBox.className = 'cell-raw';

	const rawNameEl = document.createElement( 'span' );
	rawNameEl.className = 'cell-raw__name';
	rawNameEl.textContent = rawName;
	rawNameEl.title = rawName;

	const countEl = document.createElement( 'span' );
	countEl.className = 'badge';
	countEl.textContent = `${ game.occurrences } 次`;
	countEl.title = `在录播数据中出现 ${game.occurrences} 次`;

	rawBox.append( rawNameEl, countEl );
	rawCell.appendChild( rawBox );
	row.appendChild( rawCell );

	// 可编辑的纠正后名称
	const ruleCell = document.createElement( 'td' );
	ruleCell.className = 'col-rule';
	const input = renderRuleInput( rawName );
	ruleCell.appendChild( input );
	row.appendChild( ruleCell );

	// 链式最终结果
	const finalCell = document.createElement( 'td' );
	finalCell.className = 'col-final';
	updateFinalCell( finalCell, rawName );
	row.appendChild( finalCell );

	// 提升到全局
	const promoteCell = document.createElement( 'td' );
	promoteCell.className = 'col-promote';
	const promoteBox = document.createElement( 'div' );
	promoteBox.className = 'cell-promote';

	const button = document.createElement( 'button' );
	button.type = 'button';
	button.className = 'button button--outline button--small';
	button.textContent = state.promoting === rawName ? '正在提升…' : '添加到全局';
	button.addEventListener( 'click', () => promote( rawName ) );
	promoteBox.appendChild( button );

	promoteCell.appendChild( promoteBox );
	row.appendChild( promoteCell );

	rowCells.set( rawName, { input, finalCell, button, errorHost: promoteBox } );
	// 按钮的可用状态与行内错误都要跟着规则模型走，统一在这里补一次
	updatePromoteCell( rawName );

	return row;
}

function renderRuleInput( rawName ) {
	const input = document.createElement( 'input' );
	input.className = 'input input--rule';
	input.type = 'text';
	input.value = ruleTo( rawName ) ?? '';
	input.placeholder = '未配置，填写后自动保存';
	input.autocomplete = 'off';
	input.spellcheck = false;
	input.setAttribute( 'aria-label', `把「${rawName}」纠正为` );

	input.addEventListener( 'input', () => {
		applyRule( rawName, input.value );

		// 只刷新本行的结果与操作列：整表重绘会让输入框失去焦点
		const cells = rowCells.get( rawName );
		if ( cells ) {
			updateFinalCell( cells.finalCell, rawName );
			updatePromoteCell( rawName );
		}

		scheduleSave();
	} );

	input.addEventListener( 'keydown', event => {
		if ( event.key !== 'Enter' ) return;
		// 借 blur 触发立即保存，与拼写页的行为一致
		event.preventDefault();
		input.blur();
	} );

	input.addEventListener( 'blur', () => flush() );

	return input;
}

/** 重绘某一行的「当前最终结果」单元格 */
function updateFinalCell( cell, rawName ) {
	cell.textContent = '';

	const info = resolve( rawName );
	const box = document.createElement( 'div' );
	box.className = 'cell-final';

	const nameEl = document.createElement( 'span' );
	nameEl.className = 'cell-final__name';

	if ( info.finalSource === 'none' ) {
		// 没有任何规则命中，主程序会原样使用这个游戏名
		nameEl.classList.add( 'cell-final__name--none' );
		nameEl.textContent = '未纠错';
	} else {
		nameEl.textContent = info.finalName;
		nameEl.title = info.finalName;
	}

	const badge = document.createElement( 'span' );
	badge.className = `badge badge--source-${ info.finalSource.replace( '+', '-plus-' ) }`;
	badge.textContent = SOURCE_LABEL[ info.finalSource ];

	if ( info.finalSource === 'uid+global' ) {
		badge.title = `当前规则先改为「${info.step1}」，全局规则再改为「${info.finalName}」`;
	}

	// 被当前规则挡住的全局值只在悬停时给出，避免行过宽
	if ( info.shadowedGlobalTo !== null && info.shadowedGlobalTo !== info.globalTo ) {
		badge.classList.add( 'badge--has-shadow' );
		badge.title = `全局规则「${rawName} → ${info.shadowedGlobalTo}」已被当前规则覆盖`;
	}

	box.append( nameEl, badge );
	cell.appendChild( box );
}

/** 重绘某一行的操作列：按钮可用状态 + 行内错误 */
function updatePromoteCell( rawName ) {
	const cells = rowCells.get( rawName );
	if ( !cells ) return;

	const { button, errorHost } = cells;

	for ( const stale of errorHost.querySelectorAll( '.row-error' ) ) {
		stale.remove();
	}

	const hasRule = ruleTo( rawName ) !== null;
	const busy = state.promoting === rawName;

	button.disabled = !hasRule || busy;
	button.textContent = busy ? '正在提升…' : '添加到全局';
	button.title = hasRule
		? '把这条规则从当前 UID 移到全局规则'
		: '先填写纠正后名称';

	const message = state.rowErrors[ rawName ];
	if ( message ) {
		const errorEl = document.createElement( 'span' );
		errorEl.className = 'row-error';
		errorEl.textContent = message;
		errorEl.title = message;
		errorHost.appendChild( errorEl );
	}
}

function placeholder( text ) {
	const element = document.createElement( 'p' );
	element.className = 'placeholder';
	element.textContent = text;
	return element;
}

function matchesSearch( game ) {
	const keyword = state.searchKeyword.trim().toLowerCase();
	if ( keyword === '' ) return true;

	const to = ruleTo( game.rawName ) ?? '';
	return `${ game.rawName }\n${ to }`.toLowerCase().indexOf( keyword ) !== -1;
}

// ==================== 保存状态 ====================

function renderStatus() {
	const element = document.getElementById( 'save-status' );
	if ( !element ) return;

	const save = state.save;
	element.textContent = '';
	element.className = 'status';

	let className = null;
	let text;

	if ( !state.uid ) {
		text = '未选择用户';
	} else if ( save.isSaving ) {
		className = 'status--saving';
		text = '正在保存…';
	} else if ( save.error ) {
		className = 'status--error';
		text = '保存失败';
	} else if ( JSON.stringify( state.rules ) !== save.savedSnapshot ) {
		className = 'status--dirty';
		text = '有未保存的修改';
	} else {
		className = 'status--saved';
		text = '所有修改已保存';
	}

	if ( className ) element.classList.add( className );

	const label = document.createElement( 'span' );
	label.textContent = text;
	element.appendChild( label );

	if ( !save.isSaving && save.error ) {
		const retry = document.createElement( 'button' );
		retry.type = 'button';
		retry.className = 'status__retry';
		retry.textContent = '重试';
		retry.addEventListener( 'click', () => flush() );
		element.appendChild( retry );
	}
}

// ==================== 初始化 ====================

function resetSave() {
	const save = state.save;
	clearTimeout( save.timer );
	save.timer = null;
	save.isSaving = false;
	save.pending = false;
	save.running = null;
	save.error = null;
	save.notice = '';
	save.pendingNotice = '';
	save.savedSnapshot = '[]';
	state.promoting = '';
	state.rowErrors = {};
}

async function selectUser( uid ) {
	// 先等队列排空，避免未保存的修改跟着 uid 一起被丢掉
	await flush();

	if ( state.save.error ) {
		const leave = window.confirm(
			'上一次保存失败，切换用户会丢失未保存的修改。确定要切换吗？'
		);

		if ( !leave ) {
			// 重绘会把下拉框恢复成 state.uid 对应的那一项
			render();
			return;
		}
	}

	state.uid = uid;
	state.games = null;
	state.rules = [];
	state.globalRules = {};
	state.searchKeyword = '';
	document.getElementById( 'search' ).value = '';
	resetSave();

	render();
	renderStatus();

	let data;
	try {
		const response = await fetch( `/api/games/${ encodeURIComponent( uid ) }` );
		data = await response.json().catch( () => null );

		if ( !response.ok || !data || data.success === false ) {
			throw new Error( ( data && data.message ) || `HTTP ${response.status}` );
		}
	} catch ( error ) {
		const app = document.getElementById( 'app' );
		app.textContent = '';
		state.games = null;
		const message = placeholder( `加载 UID ${uid} 的游戏名失败：${error.message}` );
		message.classList.add( 'placeholder--error' );
		app.appendChild( message );
		renderStatus();
		return;
	}

	state.games = data.games || [];
	state.rules = data.rules || [];
	state.globalRules = data.globalRules || {};

	// 以加载时的内容作为「已保存」基线
	state.save.savedSnapshot = JSON.stringify( state.rules );

	render();
	renderStatus();

	// 把选择写进 URL，刷新页面后不会跳回第一个用户
	window.history.replaceState( null, '', `?uid=${ encodeURIComponent( uid ) }` );
}

async function init() {
	const app = document.getElementById( 'app' );

	try {
		const response = await fetch( '/api/games/users' );
		if ( !response.ok ) {
			throw new Error( `HTTP ${response.status}` );
		}

		const data = await response.json();
		state.users = data.users || [];
	} catch ( error ) {
		app.textContent = '';
		const message = placeholder( `加载用户列表失败：${error.message}。请确认本地服务仍在运行，然后刷新页面。` );
		message.classList.add( 'placeholder--error' );
		app.appendChild( message );
		renderStatus();
		return;
	}

	if ( state.users.length === 0 ) {
		render();
		renderStatus();
		return;
	}

	const wanted = new URLSearchParams( window.location.search ).get( 'uid' );
	const initial = state.users.find( user => user.uid === wanted ) || state.users[ 0 ];

	await selectUser( initial.uid );
}

const searchInput = document.getElementById( 'search' );
let searchTimer = null;

searchInput.addEventListener( 'input', () => {
	clearTimeout( searchTimer );
	searchTimer = setTimeout( () => {
		state.searchKeyword = searchInput.value;
		// 搜索会改变可见行，这里必须整表重绘；此时输入框不是焦点，不影响编辑
		render();
	}, SEARCH_DEBOUNCE_MS );
} );

init();
