/**
 * 拼写纠正编辑器前端
 *
 * 保存模型：按「部分」独立维护保存队列
 *   - 部分 key：'global' 或 `uid:<uid>`
 *   - 每个部分独立维护 isSaving / pending / debounceTimer / savedSnapshot / error
 *   - 防抖 800ms 触发，输入框失焦立即触发，保存中产生的修改会在本次完成后合并提交
 */

const SAVE_DEBOUNCE_MS = 800;
const GLOBAL_KEY = 'global';
const UID_KEY_PREFIX = 'uid:';

/** 全局状态 */
const state = {
	/** 完整 V2 配置：{ version, global: { rules }, uidRules: { uid: { rules } } } */
	config: null,
	/** 每个部分新增中、尚未成型的草稿行 */
	drafts: new Map(),
	/** 每个部分的保存队列状态 */
	parts: new Map(),
	/** 搜索关键字，纯前端过滤 */
	searchKeyword: ''
};

// ==================== 状态访问 ====================

function allPartKeys() {
	return [
		GLOBAL_KEY,
		...Object.keys( state.config.uidRules ).map( uid => `${UID_KEY_PREFIX}${uid}` )
	];
}

function getPart( key ) {
	if ( !state.parts.has( key ) ) {
		state.parts.set( key, {
			isSaving: false,
			pending: false,
			timer: null,
			savedSnapshot: '',
			error: null
		} );
	}
	return state.parts.get( key );
}

/** 该部分的正式规则数组（引用 state.config 中的数组） */
function rulesOf( key ) {
	if ( key === GLOBAL_KEY ) {
		return state.config.global.rules;
	}
	return state.config.uidRules[ key.slice( UID_KEY_PREFIX.length ) ].rules;
}

/** 该部分的草稿行数组 */
function draftsOf( key ) {
	if ( !state.drafts.has( key ) ) {
		state.drafts.set( key, [] );
	}
	return state.drafts.get( key );
}

/** 草稿行只有在 from / to 都填好之后才算一条真正的规则 */
function completeRules( rules ) {
	return rules.filter( rule => rule.from.trim() !== '' && rule.to.trim() !== '' );
}

/** 提交给后端的规则：正式规则原样提交（留空由后端报错），草稿行只提交填完的 */
function payloadFor( key ) {
	return [ ...rulesOf( key ), ...completeRules( draftsOf( key ) ) ];
}

function snapshotOf( key ) {
	return JSON.stringify( payloadFor( key ) );
}

// ==================== 保存 ====================

function scheduleSave( key ) {
	const part = getPart( key );
	clearTimeout( part.timer );
	part.timer = setTimeout( () => {
		part.timer = null;
		flush( key );
	}, SAVE_DEBOUNCE_MS );
	renderStatus();
}

/** 提交某个部分的修改；保存中再次触发会被合并到本次之后 */
async function flush( key ) {
	const part = getPart( key );
	clearTimeout( part.timer );
	part.timer = null;

	if ( part.isSaving ) {
		part.pending = true;
		return;
	}

	const payload = payloadFor( key );
	const snapshot = JSON.stringify( payload );

	if ( snapshot === part.savedSnapshot ) {
		renderStatus();
		return;
	}

	part.isSaving = true;
	renderStatus();

	try {
		await postRules( key, payload );
		part.savedSnapshot = snapshot;
		part.error = null;
	} catch ( error ) {
		part.error = error.message;
	} finally {
		part.isSaving = false;
		renderStatus();
	}

	// 保存期间的修改：本次成功后立即补交，失败则等用户重试
	if ( part.pending ) {
		part.pending = false;
		if ( !part.error ) {
			return flush( key );
		}
	}
}

async function postRules( key, rules ) {
	const url = key === GLOBAL_KEY
		? '/api/spelling/global'
		: `/api/spelling/uid/${encodeURIComponent( key.slice( UID_KEY_PREFIX.length ) )}`;

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

// ==================== 渲染 ====================

function render() {
	const app = document.getElementById( 'app' );
	app.textContent = '';

	if ( !state.config ) {
		app.appendChild( placeholder( '正在加载配置…' ) );
		return;
	}

	app.appendChild( renderSection( GLOBAL_KEY, '全局规则', '适用于所有主播' ) );

	const uids = Object.keys( state.config.uidRules );

	const groupTitle = document.createElement( 'h2' );
	groupTitle.className = 'section-title';
	groupTitle.textContent = `UID 专属规则（${uids.length}）`;
	app.appendChild( groupTitle );

	if ( uids.length === 0 ) {
		app.appendChild( placeholder( '配置中还没有 UID 专属规则分组。' ) );
	} else {
		for ( const uid of uids ) {
			app.appendChild( renderSection( `${UID_KEY_PREFIX}${uid}`, `UID ${uid}`, '仅对该 UID 生效' ) );
		}
	}
}

function renderSection( key, title, subtitle ) {
	const card = document.createElement( 'section' );
	card.className = 'card';
	card.dataset.part = key;

	const header = document.createElement( 'div' );
	header.className = 'card__header';

	const titleBox = document.createElement( 'div' );
	const titleEl = document.createElement( 'h2' );
	titleEl.className = 'card__title';
	titleEl.textContent = title;
	const subtitleEl = document.createElement( 'p' );
	subtitleEl.className = 'card__subtitle';
	subtitleEl.textContent = subtitle;
	titleBox.append( titleEl, subtitleEl );

	const total = rulesOf( key ).length + draftsOf( key ).length;
	const badge = document.createElement( 'span' );
	badge.className = 'badge';
	badge.textContent = `${total} 条规则`;

	header.append( titleBox, badge );
	card.appendChild( header );

	const errorBox = document.createElement( 'p' );
	errorBox.className = 'card__error';
	errorBox.hidden = true;
	card.appendChild( errorBox );

	card.appendChild( renderTable( key ) );

	const footer = document.createElement( 'div' );
	footer.className = 'card__footer';
	const addButton = document.createElement( 'button' );
	addButton.type = 'button';
	addButton.className = 'button button--outline';
	addButton.textContent = '新增规则';
	addButton.addEventListener( 'click', () => addDraft( key ) );
	footer.appendChild( addButton );
	card.appendChild( footer );

	return card;
}

function renderTable( key ) {
	const table = document.createElement( 'table' );
	table.className = 'table';

	const head = document.createElement( 'thead' );
	const headRow = document.createElement( 'tr' );
	for ( const [ text, className ] of [ [ '#', 'col-index' ], [ 'from（错误名称）', '' ], [ 'to（正确名称）', '' ], [ '操作', 'col-action' ] ] ) {
		const th = document.createElement( 'th' );
		if ( className ) th.className = className;
		th.textContent = text;
		headRow.appendChild( th );
	}
	head.appendChild( headRow );
	table.appendChild( head );

	const body = document.createElement( 'tbody' );
	let visibleCount = 0;

	rulesOf( key ).forEach( ( rule, index ) => {
		if ( !matchesSearch( rule ) ) return;
		visibleCount++;
		body.appendChild( renderRuleRow( key, rule, index ) );
	} );

	draftsOf( key ).forEach( ( draft, draftIndex ) => {
		if ( !matchesSearch( draft ) ) return;
		visibleCount++;
		body.appendChild( renderDraftRow( key, draft, draftIndex ) );
	} );

	if ( visibleCount === 0 ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.className = 'table__empty';
		cell.colSpan = 4;
		cell.textContent = state.searchKeyword.trim() === ''
			? '还没有规则，点击下方「新增规则」添加。'
			: '没有匹配的规则。';
		row.appendChild( cell );
		body.appendChild( row );
	}

	table.appendChild( body );
	return table;
}

function renderRuleRow( key, rule, index ) {
	const row = document.createElement( 'tr' );

	const indexCell = document.createElement( 'td' );
	indexCell.className = 'col-index';
	indexCell.textContent = String( index + 1 );
	row.appendChild( indexCell );

	// 已有规则的 from 只读：它是匹配键，改动等同于换一条规则
	const fromCell = document.createElement( 'td' );
	const fromInput = document.createElement( 'input' );
	fromInput.className = 'input';
	fromInput.value = rule.from;
	fromInput.readOnly = true;
	fromInput.title = '已有规则的 from 不可修改，如需调整请删除后重新添加';
	fromCell.appendChild( fromInput );
	row.appendChild( fromCell );

	const toCell = document.createElement( 'td' );
	const toInput = document.createElement( 'input' );
	toInput.className = 'input';
	toInput.value = rule.to;
	toInput.spellcheck = false;
	bindEditableInput( toInput, key, value => {
		rule.to = value;
	} );
	toCell.appendChild( toInput );
	row.appendChild( toCell );

	row.appendChild( renderDeleteCell( key, `确定删除规则「${rule.from}」吗？`, () => {
		rulesOf( key ).splice( index, 1 );
	} ) );

	return row;
}

function renderDraftRow( key, draft, draftIndex ) {
	const row = document.createElement( 'tr' );
	row.className = 'table__row--draft';

	const indexCell = document.createElement( 'td' );
	indexCell.className = 'col-index';
	indexCell.textContent = '新';
	row.appendChild( indexCell );

	const fromCell = document.createElement( 'td' );
	const fromInput = document.createElement( 'input' );
	fromInput.className = 'input';
	fromInput.value = draft.from;
	fromInput.placeholder = '错误名称';
	fromInput.spellcheck = false;
	fromInput.title = 'from 与 to 都填写后才会保存';
	bindEditableInput( fromInput, key, value => {
		draft.from = value;
	} );
	fromCell.appendChild( fromInput );
	row.appendChild( fromCell );

	const toCell = document.createElement( 'td' );
	const toInput = document.createElement( 'input' );
	toInput.className = 'input';
	toInput.value = draft.to;
	toInput.placeholder = '正确名称';
	toInput.spellcheck = false;
	toInput.title = 'from 与 to 都填写后才会保存';
	bindEditableInput( toInput, key, value => {
		draft.to = value;
	} );
	toCell.appendChild( toInput );
	row.appendChild( toCell );

	row.appendChild( renderDeleteCell( key, '确定放弃这条新增规则吗？', () => {
		draftsOf( key ).splice( draftIndex, 1 );
	} ) );

	return row;
}

function renderDeleteCell( key, confirmMessage, remove ) {
	const cell = document.createElement( 'td' );
	cell.className = 'col-action';

	const button = document.createElement( 'button' );
	button.type = 'button';
	button.className = 'button button--ghost';
	button.textContent = '删除';
	button.addEventListener( 'click', () => {
		if ( !window.confirm( confirmMessage ) ) return;
		remove();
		render();
		flush( key );
	} );

	cell.appendChild( button );
	return cell;
}

/** 绑定输入框：输入时更新模型并排入防抖队列，失焦 / 回车立即保存 */
function bindEditableInput( input, key, apply ) {
	input.addEventListener( 'input', () => {
		apply( input.value );
		scheduleSave( key );
	} );

	input.addEventListener( 'blur', () => {
		apply( input.value );
		flush( key );
	} );

	input.addEventListener( 'keydown', event => {
		if ( event.key === 'Enter' ) {
			input.blur();
		}
	} );
}

function addDraft( key ) {
	draftsOf( key ).push( { from: '', to: '' } );
	render();

	// 渲染后把焦点落到刚新增的 from 输入框
	const card = document.querySelector( `.card[data-part="${cssEscape( key )}"]` );
	const rows = card ? card.querySelectorAll( '.table__row--draft' ) : [];
	const lastRow = rows[ rows.length - 1 ];
	if ( lastRow ) {
		lastRow.querySelector( 'input' ).focus();
	}
}

function placeholder( text ) {
	const element = document.createElement( 'p' );
	element.className = 'placeholder';
	element.textContent = text;
	return element;
}

function matchesSearch( rule ) {
	const keyword = state.searchKeyword.trim().toLowerCase();
	if ( keyword === '' ) return true;

	return rule.from.toLowerCase().includes( keyword ) || rule.to.toLowerCase().includes( keyword );
}

function cssEscape( value ) {
	return window.CSS && window.CSS.escape ? window.CSS.escape( value ) : value.replace( /"/g, '\\"' );
}

// ==================== 保存状态 ====================

function renderStatus() {
	const element = document.getElementById( 'save-status' );
	if ( !element || !state.config ) return;

	const keys = allPartKeys();
	const failedKeys = keys.filter( key => getPart( key ).error );
	const isSaving = keys.some( key => getPart( key ).isSaving );
	const isDirty = keys.some( key => snapshotOf( key ) !== getPart( key ).savedSnapshot );

	element.textContent = '';
	element.className = 'status';

	let className;
	let text;

	if ( isSaving ) {
		className = 'status--saving';
		text = '正在保存…';
	} else if ( failedKeys.length > 0 ) {
		className = 'status--error';
		text = `保存失败（${failedKeys.length} 处）`;
	} else if ( isDirty ) {
		className = 'status--dirty';
		text = '有未保存的修改';
	} else {
		className = 'status--saved';
		text = '所有修改已保存';
	}

	element.classList.add( className );

	const label = document.createElement( 'span' );
	label.textContent = text;
	element.appendChild( label );

	if ( !isSaving && failedKeys.length > 0 ) {
		const retry = document.createElement( 'button' );
		retry.type = 'button';
		retry.className = 'status__retry';
		retry.textContent = '重试';
		retry.addEventListener( 'click', () => failedKeys.forEach( flush ) );
		element.appendChild( retry );
	}

	syncSectionErrors();
}

/** 把每个部分的错误信息同步到对应卡片顶部的提示条 */
function syncSectionErrors() {
	document.querySelectorAll( '.card[data-part]' ).forEach( card => {
		const errorBox = card.querySelector( '.card__error' );
		if ( !errorBox ) return;

		const error = getPart( card.dataset.part ).error;
		errorBox.hidden = !error;
		errorBox.textContent = error || '';
	} );
}

// ==================== 初始化 ====================

async function load() {
	const app = document.getElementById( 'app' );

	try {
		const response = await fetch( '/api/spelling' );
		if ( !response.ok ) {
			throw new Error( `HTTP ${response.status}` );
		}

		state.config = await response.json();
	} catch ( error ) {
		const message = placeholder( `加载配置失败：${error.message}。请确认本地服务仍在运行，然后刷新页面。` );
		message.classList.add( 'placeholder--error' );
		app.textContent = '';
		app.appendChild( message );
		return;
	}

	// 以加载时的内容作为「已保存」基线
	for ( const key of allPartKeys() ) {
		getPart( key ).savedSnapshot = snapshotOf( key );
	}

	render();
	renderStatus();
}

document.getElementById( 'search' ).addEventListener( 'input', event => {
	state.searchKeyword = event.target.value;
	render();
	renderStatus();
} );

load();
