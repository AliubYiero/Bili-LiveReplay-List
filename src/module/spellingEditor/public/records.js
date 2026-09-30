/**
 * 录播数据编辑器前端
 *
 * 保存模型与拼写页一致：整个 aid.json 是一个保存单元
 *   - 防抖 800ms 触发，输入框失焦立即触发
 *   - 保存中产生的修改会在本次完成后合并提交
 *   - 后端按 key 合并写入，因此不会覆盖主程序并发补入的 key
 */

const SAVE_DEBOUNCE_MS = 800;
const SEARCH_DEBOUNCE_MS = 200;

const state = {
	/** 可用用户列表：只含同时存在 record.json 与 aid.json 的用户 */
	users: [],
	uid: '',
	userName: '',
	/** 当前用户的 record.json */
	record: null,
	/** 当前用户的 aid 映射，key 为 String(aid) */
	aid: {},
	/** 搜索关键字，纯前端过滤 */
	searchKeyword: '',
	save: {
		isSaving: false,
		pending: false,
		timer: null,
		savedSnapshot: '',
		error: null,
		/** 批量应用的结果提示，保存成功后才展示 */
		notice: '',
		pendingNotice: ''
	}
};

// ==================== 模型访问 ====================

function recordList() {
	return state.record && Array.isArray( state.record.records ) ? state.record.records : [];
}

function aidKey( record ) {
	return String( record.aid );
}

/** 某条记录当前的映射游戏；缺失时是空数组，首次编辑才会创建 key */
function gamesOf( record ) {
	return state.aid[ aidKey( record ) ] || [];
}

/** 已有人工映射的记录条数 */
function mappedCount() {
	return recordList().filter( record => gamesOf( record ).length > 0 ).length;
}

/**
 * 游玩游戏的分组键：排序后序列化
 * 顺序不同但内容相同的 playGame 视为同一组，用于批量应用
 */
function playGameKey( record ) {
	return JSON.stringify( [ ...( record.playGame || [] ) ].sort() );
}

// ==================== 保存 ====================

function scheduleSave() {
	const save = state.save;
	clearTimeout( save.timer );
	save.timer = setTimeout( () => {
		save.timer = null;
		flush();
	}, SAVE_DEBOUNCE_MS );

	// 新的编辑动作意味着上一次的批量结果提示已经过时
	save.notice = '';
	renderStatus();
}

/** 提交修改；保存中再次触发会被合并到本次之后 */
async function flush() {
	const save = state.save;
	clearTimeout( save.timer );
	save.timer = null;

	if ( !state.uid ) return;

	if ( save.isSaving ) {
		save.pending = true;
		return;
	}

	const snapshot = JSON.stringify( state.aid );
	if ( snapshot === save.savedSnapshot ) {
		renderStatus();
		return;
	}

	save.isSaving = true;
	renderStatus();

	try {
		await postAid( state.aid );
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
		renderStatus();
	}

	// 保存期间的修改：本次成功后立即补交，失败则等用户重试
	if ( save.pending ) {
		save.pending = false;
		if ( !save.error ) {
			return flush();
		}
	}
}

async function postAid( rules ) {
	const url = `/api/records/${encodeURIComponent( state.uid )}/${encodeURIComponent( state.userName )}/aid`;

	let response;
	try {
		response = await fetch( url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( { rules } )
		} );
	} catch ( error ) {
		throw new Error( '无法连接到本地服务，请确认 npm run edit 仍在运行' );
	}

	let data = null;
	try {
		data = await response.json();
	} catch ( error ) {
		// 响应体不是 JSON，下面按状态码兜底报错
	}

	if ( !response.ok || !data || data.success !== true ) {
		throw new Error( ( data && data.message ) || `保存失败（HTTP ${response.status}）` );
	}
}

// ==================== 编辑动作 ====================

function addGame( record, game, focus ) {
	const key = aidKey( record );
	const games = gamesOf( record );

	if ( games.indexOf( game ) !== -1 ) {
		// 已存在，不重复添加，但要把输入框清空
		render();
		return;
	}

	state.aid[ key ] = [ ...games, game ];
	// 先 scheduleSave 再 render：它会清掉过时的批量结果提示，顺序反了提示会滞留一帧
	scheduleSave();
	render( focus ? key : undefined );
}

/** 删除标签；删光后 key 保留为空数组，表示回退到自动解析 */
function removeGame( record, game ) {
	const key = aidKey( record );

	state.aid[ key ] = gamesOf( record ).filter( item => item !== game );
	scheduleSave();
	render();
}

/**
 * 把当前记录的映射游戏应用到所有 playGame 完全相同的记录
 */
function applyToSamePlayGame( record ) {
	const games = gamesOf( record );
	if ( games.length === 0 ) return;

	const groupKey = playGameKey( record );
	const targets = recordList().filter( item => playGameKey( item ) === groupKey );
	const playGameText = ( record.playGame || [] ).join( '、' ) || '(空)';

	const message = `将把「${games.join( '、' )}」应用到 ${targets.length} 条游玩游戏为「${playGameText}」的记录（含本条），确定吗？`;
	if ( !window.confirm( message ) ) return;

	const copied = [ ...games ];
	for ( const item of targets ) {
		state.aid[ aidKey( item ) ] = [ ...copied ];
	}

	state.save.pendingNotice = `已更新 ${targets.length} 条`;
	render();
	flush();
}

// ==================== 渲染 ====================

function render( focusAid ) {
	const app = document.getElementById( 'app' );
	app.textContent = '';

	if ( state.users.length === 0 ) {
		app.appendChild( placeholder( 'data/ 下还没有同时存在 record.json 与 aid.json 的用户。' ) );
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

	if ( !state.record ) {
		card.appendChild( placeholder( `正在加载 ${state.userName} 的数据…` ) );
		app.appendChild( card );
		return;
	}

	card.appendChild( renderTable() );
	app.appendChild( card );

	if ( focusAid !== undefined ) {
		const input = document.querySelector( `.chip-input[data-aid="${cssEscape( focusAid )}"]` );
		if ( input ) input.focus();
	}
}

function renderHeader() {
	const header = document.createElement( 'div' );
	header.className = 'card__header';

	const titleBox = document.createElement( 'div' );
	const titleEl = document.createElement( 'h2' );
	titleEl.className = 'card__title';
	titleEl.textContent = state.userName || '未选择用户';

	const subtitleEl = document.createElement( 'p' );
	subtitleEl.className = 'card__subtitle';
	subtitleEl.textContent = state.record
		? `UID ${state.uid} · ${recordList().length} 条记录 · ${mappedCount()} 条已人工映射`
		: `UID ${state.uid}`;

	titleBox.append( titleEl, subtitleEl );

	const select = document.createElement( 'select' );
	select.className = 'select';
	select.id = 'user-select';
	select.setAttribute( 'aria-label', '选择用户' );

	for ( const user of state.users ) {
		const option = document.createElement( 'option' );
		option.value = user.uid;
		option.textContent = `${user.userName}（UID ${user.uid}）`;
		option.selected = user.uid === state.uid;
		select.appendChild( option );
	}

	select.addEventListener( 'change', () => {
		const next = state.users.find( user => user.uid === select.value );
		if ( next ) selectUser( next.uid, next.userName );
	} );

	header.append( titleBox, select );
	return header;
}

function renderTable() {
	const scroll = document.createElement( 'div' );
	scroll.className = 'card__scroll';

	const table = document.createElement( 'table' );
	table.className = 'table table--records';

	const head = document.createElement( 'thead' );
	const headRow = document.createElement( 'tr' );
	for ( const [ text, className ] of [
		[ '#', 'col-index' ],
		[ '标题', 'col-title' ],
		[ '游玩游戏（自动解析）', 'col-play' ],
		[ '映射游戏（最终使用）', 'col-map' ],
		[ '操作', 'col-apply' ]
	] ) {
		const th = document.createElement( 'th' );
		th.className = className;
		th.textContent = text;
		headRow.appendChild( th );
	}
	head.appendChild( headRow );
	table.appendChild( head );

	const body = document.createElement( 'tbody' );
	const records = recordList();
	let visible = 0;

	records.forEach( ( record, index ) => {
		if ( !matchesSearch( record ) ) return;
		visible++;
		body.appendChild( renderRow( record, index ) );
	} );

	if ( visible === 0 ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.className = 'table__empty';
		cell.colSpan = 5;
		cell.textContent = records.length === 0
			? '这个用户还没有录播记录。'
			: '没有匹配的记录。';
		row.appendChild( cell );
		body.appendChild( row );
	}

	table.appendChild( body );
	scroll.appendChild( table );
	return scroll;
}

function renderRow( record, index ) {
	const row = document.createElement( 'tr' );
	const games = gamesOf( record );

	// 编号：数组序号 + 1，与设计稿一致
	const indexCell = document.createElement( 'td' );
	indexCell.className = 'col-index';
	indexCell.textContent = String( index + 1 );
	row.appendChild( indexCell );

	const titleCell = document.createElement( 'td' );
	titleCell.className = 'col-title';
	const titleEl = document.createElement( 'span' );
	titleEl.className = 'cell-title';
	titleEl.textContent = record.title || '(无标题)';
	titleEl.title = record.title || '';
	titleCell.appendChild( titleEl );
	row.appendChild( titleCell );

	// 游玩游戏：只读，来自标题解析
	const playCell = document.createElement( 'td' );
	playCell.className = 'col-play';
	playCell.appendChild( renderReadonlyChips( record.playGame || [] ) );
	row.appendChild( playCell );

	// 映射游戏：可编辑
	const mapCell = document.createElement( 'td' );
	mapCell.className = 'col-map';
	mapCell.appendChild( renderEditableChips( record, games ) );
	row.appendChild( mapCell );

	// 操作：批量应用
	const actionCell = document.createElement( 'td' );
	actionCell.className = 'col-apply';
	const applyButton = document.createElement( 'button' );
	applyButton.type = 'button';
	applyButton.className = 'button button--outline button--small';
	applyButton.textContent = '应用到相同游玩游戏';
	applyButton.disabled = games.length === 0;
	applyButton.title = games.length === 0
		? '先给这条记录添加映射游戏'
		: '把当前映射游戏应用到所有游玩游戏完全相同的记录';
	applyButton.addEventListener( 'click', () => applyToSamePlayGame( record ) );
	actionCell.appendChild( applyButton );
	row.appendChild( actionCell );

	return row;
}

function renderReadonlyChips( games ) {
	const box = document.createElement( 'div' );
	box.className = 'chips';

	if ( games.length === 0 ) {
		box.appendChild( autoChip( '无' ) );
		return box;
	}

	for ( const game of games ) {
		const chip = document.createElement( 'span' );
		chip.className = 'chip chip--readonly';
		const label = document.createElement( 'span' );
		label.className = 'chip__label';
		label.textContent = game;
		label.title = game;
		chip.appendChild( label );
		box.appendChild( chip );
	}

	return box;
}

function renderEditableChips( record, games ) {
	const box = document.createElement( 'div' );
	box.className = 'chips';

	// 空数组表示没有人工映射，主程序会回退到上面那列自动解析的结果
	if ( games.length === 0 ) {
		box.appendChild( autoChip( '未映射 · 使用自动解析' ) );
	}

	for ( const game of games ) {
		box.appendChild( renderRemovableChip( record, game ) );
	}

	box.appendChild( renderChipInput( record ) );
	return box;
}

function autoChip( text ) {
	const chip = document.createElement( 'span' );
	chip.className = 'chip chip--auto';
	chip.textContent = text;
	return chip;
}

function renderRemovableChip( record, game ) {
	const chip = document.createElement( 'span' );
	chip.className = 'chip';

	const label = document.createElement( 'span' );
	label.className = 'chip__label';
	label.textContent = game;
	label.title = game;

	const remove = document.createElement( 'button' );
	remove.type = 'button';
	remove.className = 'chip__remove';
	remove.textContent = '×';
	remove.title = `删除「${game}」`;
	remove.setAttribute( 'aria-label', `删除 ${game}` );
	remove.addEventListener( 'click', () => removeGame( record, game ) );

	chip.append( label, remove );
	return chip;
}

/** chip 输入框：回车添加，失焦时把已输入内容一并收下，避免用户以为已经加上了 */
function renderChipInput( record ) {
	const input = document.createElement( 'input' );
	input.className = 'chip-input';
	input.type = 'text';
	input.placeholder = '添加游戏…';
	input.autocomplete = 'off';
	input.spellcheck = false;
	input.dataset.aid = aidKey( record );

	input.addEventListener( 'keydown', event => {
		if ( event.key !== 'Enter' ) return;
		event.preventDefault();

		const value = input.value.trim();
		if ( value === '' ) return;
		addGame( record, value, true );
	} );

	input.addEventListener( 'blur', () => {
		const value = input.value.trim();
		if ( value !== '' ) {
			// 失焦提交不再抢回焦点，否则会把人困在这个输入框里
			addGame( record, value, false );
			return;
		}
		flush();
	} );

	return input;
}

function placeholder( text ) {
	const element = document.createElement( 'p' );
	element.className = 'placeholder';
	element.textContent = text;
	return element;
}

function cssEscape( value ) {
	return window.CSS && window.CSS.escape ? window.CSS.escape( value ) : value.replace( /"/g, '\\"' );
}

function matchesSearch( record ) {
	const keyword = state.searchKeyword.trim().toLowerCase();
	if ( keyword === '' ) return true;

	const haystack = [
		record.title || '',
		...( record.playGame || [] ),
		...gamesOf( record ),
		aidKey( record )
	].join( '\n' ).toLowerCase();

	return haystack.indexOf( keyword ) !== -1;
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
	} else if ( JSON.stringify( state.aid ) !== save.savedSnapshot ) {
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
	save.error = null;
	save.notice = '';
	save.pendingNotice = '';
	save.savedSnapshot = '';
}

async function selectUser( uid, userName ) {
	state.uid = uid;
	state.userName = userName;
	state.record = null;
	state.aid = {};
	state.searchKeyword = '';
	document.getElementById( 'search' ).value = '';
	resetSave();

	render();
	renderStatus();

	let data;
	try {
		const response = await fetch( `/api/records/${encodeURIComponent( uid )}/${encodeURIComponent( userName )}` );
		data = await response.json().catch( () => null );

		if ( !response.ok || !data || data.success === false ) {
			throw new Error( ( data && data.message ) || `HTTP ${response.status}` );
		}
	} catch ( error ) {
		const app = document.getElementById( 'app' );
		app.textContent = '';
		const message = placeholder( `加载 ${userName} 的数据失败：${error.message}` );
		message.classList.add( 'placeholder--error' );
		app.appendChild( message );
		renderStatus();
		return;
	}

	state.record = data.record;
	state.aid = data.aid || {};

	// 以加载时的内容作为「已保存」基线
	state.save.savedSnapshot = JSON.stringify( state.aid );

	render();
	renderStatus();

	// 把选择写进 URL，刷新页面后不会跳回第一个用户
	window.history.replaceState( null, '', `?uid=${encodeURIComponent( uid )}` );
}

async function init() {
	const app = document.getElementById( 'app' );

	try {
		const response = await fetch( '/api/records/users' );
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

	await selectUser( initial.uid, initial.userName );
}

const searchInput = document.getElementById( 'search' );
let searchTimer = null;

searchInput.addEventListener( 'input', event => {
	clearTimeout( searchTimer );
	searchTimer = setTimeout( () => {
		state.searchKeyword = searchInput.value;
		render();
	}, SEARCH_DEBOUNCE_MS );
} );

init();
