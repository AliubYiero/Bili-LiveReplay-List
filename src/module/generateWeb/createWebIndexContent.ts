import { StreamerRecord } from './generateWeb.ts';

/**
 * 创建 index.html 内容
 */
export const createWebIndexContent = (streamerRecords: StreamerRecord[]) => {
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
	<link rel="shortcut icon" href="./icon.svg" type="image/svg">
    <title>直播回放索引</title>
    <style>
        /* --- CSS Reset & Variables --- */
        :root {
            --background: #ffffff;
            --foreground: #09090b;
            --muted: #f4f4f5;
            --muted-foreground: #71717a;
            --border: #e4e4e7;
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --ring: #c7d2fe;
            --radius: 0.5rem;
            --end-tag-bg: #f3f0ff;
            --end-tag-border: #ddd6fe;
            --end-tag-text: #7c3aed;
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
            --header-height: 60px;
            --sidebar-width: 280px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; outline: none; }
        
        body {
            font-family: var(--font-sans);
            background-color: #f8fafc; /* Slightly darker bg for contrast with cards */
            color: var(--foreground);
            height: 100vh;
            width: 100vw;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        /* --- 1. Global Top Header (No Width Limit) --- */
        .global-header {
            height: var(--header-height);
            background: #fff;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 2rem;
            flex-shrink: 0;
            z-index: 50;
            position: relative;
            min-width: 420px;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-weight: 700;
            font-size: 1.1rem;
            color: var(--foreground);
            cursor: pointer;
        }
        .brand svg { color: var(--primary); width: 24px; height: 24px; }
        
        .search-bar {
            position: relative;
            width: 300px;
        }
        .search-input {
            width: 100%;
            height: 36px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            background: #f8fafc;
            padding: 0 0.75rem 0 2.25rem;
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        .search-input:focus { background: #fff; border-color: var(--ring); box-shadow: 0 0 0 2px var(--ring); }
        .search-icon {
            position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);
            width: 16px; height: 16px; color: var(--muted-foreground);
        }

        /* --- Main Layout Container --- */
        .app-container {
            flex: 1;
            display: flex;
            overflow: hidden;
            max-width: 100%;
        }

        /* --- Left Sidebar --- */
        aside {
            width: var(--sidebar-width);
            background: #fff;
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }
        .sidebar-title {
            padding: 1rem 1.25rem;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--muted-foreground);
            font-weight: 600;
        }
        .streamer-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
        .streamer-list::-webkit-scrollbar { width: 4px; }
        .streamer-list::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 4px; }

        .streamer-item {
            display: flex; align-items: center; gap: 0.75rem;
            padding: 0.6rem 0.75rem; border-radius: var(--radius);
            cursor: pointer; transition: all 0.15s; margin-bottom: 2px;
        }
        .streamer-item:hover { background: #f4f4f5; }
        .streamer-item.active { background: #eef2ff; color: var(--primary); border: 1px solid var(--ring); }
        .avatar {
            width: 32px; height: 32px; border-radius: 50%; background: #e4e4e7;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.75rem; font-weight: 600; color: #52525b; flex-shrink: 0;
        }
        .streamer-item.active .avatar { background: #c7d2fe; color: var(--primary); }
        .streamer-info { flex: 1; min-width: 0; }
        .s-name { font-weight: 500; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .s-meta { font-size: 0.75rem; color: var(--muted-foreground); margin-top: 2px; }
        .streamer-item.active .s-meta { color: #818cf8; }

        /* --- Right Content Area --- */
        .content-container {
            flex: 1;
            background: #f8fafc;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
            min-width: 350px;
        }

        /* View: Uploader Selection (Grid) */
        .view-select {
            padding: 2rem;
            overflow-y: auto;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        .view-select::-webkit-scrollbar { width: 6px; }
        .view-select::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 4px; }

        .select-header { margin-bottom: 2rem; }
        .select-header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
        .select-header p { color: var(--muted-foreground); }

        .uploader-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.5rem;
            align-content: start;
        }

        .card {
            border: 1px solid var(--border); border-radius: 0.75rem; background: #fff;
            padding: 1.25rem; display: flex; flex-direction: column;
            transition: all 0.2s; cursor: pointer; position: relative;
        }
        .card:hover { border-color: var(--ring); box-shadow: 0 4px 12px rgba(0,0,0,0.05); transform: translateY(-1px); }
        
        .card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
        .card-title { font-size: 1rem; font-weight: 600; }
        
        /* REQ 3: Badge Text Change */
        .badge-self {
            font-size: 0.7rem; padding: 2px 8px; border-radius: 99px;
            background: #eef2ff; color: var(--primary); border: 1px solid #c7d2fe; font-weight: 600;
        }
        .badge-other {
            font-size: 0.7rem; padding: 2px 8px; border-radius: 99px;
            background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; font-weight: 600;
        }

        .card-stats {
            display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
            margin-bottom: 1.25rem; padding: 0.75rem; background: #fafafa;
            border-radius: var(--radius); border: 1px solid #f4f4f5;
        }
        .stat-item {display: flex;flex-direction: column;gap: 2px;}
        .stat-label { font-size: 0.7rem; color: var(--muted-foreground); text-transform: uppercase; }
        .stat-val { font-size: 0.875rem; font-weight: 500; }
        .stat-val.mono { font-family: var(--font-mono); }

        .card-foot { margin-top: auto; display: flex; justify-content: flex-end; }
        .btn-enter {
            display: inline-flex; align-items: center; gap: 0.5rem;
            background: var(--primary); color: #fff; padding: 0.5rem 1rem;
            border-radius: var(--radius); font-size: 0.875rem; font-weight: 500;
            border: none; cursor: pointer; transition: background 0.2s;
        }
        .btn-enter:hover { background: var(--primary-hover); }

        /* Empty State */
        .empty-state {
            height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: var(--muted-foreground); text-align: center;
        }
        .empty-state svg { width: 64px; height: 64px; margin-bottom: 1rem; opacity: 0.3; }

        /* View: Records List (Detail) */
        .view-records {
            flex: 1; display: flex; flex-direction: column; background: #fff;
            border-left: 1px solid var(--border);
            min-height: 0;
        }
        .rec-header {
            height: 60px; border-bottom: 1px solid var(--border); padding: 0 1.5rem;
            display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
        }
        .page-title { font-weight: 700; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
        .page-title svg { color: var(--primary); width: 18px; height: 18px; }
        
        .btn-tool {
            height: 34px; padding: 0 0.875rem; border-radius: var(--radius);
            font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: 0.2s;
            border: 1px solid transparent; background: transparent; color: var(--foreground);
            display: inline-flex; align-items: center; gap: 0.5rem;
        }
        .btn-tool:hover { background: var(--muted); }
        .btn-outline { border-color: var(--border); }
        .btn-svg { width: 14px; height: 14px; }

        .meta-bar {
            padding: 1rem 1.5rem; background: #fafafa; border-bottom: 1px solid var(--border);
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.875rem; flex-shrink: 0;
        }
        .meta-item { display: flex; flex-direction: column; gap: 4px; }
        .meta-label { font-size: 0.75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; }
        .meta-val { font-weight: 600; color: var(--foreground); display: flex; align-items: center; gap: 0.5rem; }
        .meta-link { color: var(--primary); text-decoration: none; max-width: 200px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
        .meta-link:hover { text-decoration: underline; }

        .filter-bar {
            padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
            display: flex; align-items: center; gap: 1rem; background: #fff; flex-shrink: 0;
        }
        .sel-wrap { position: relative; min-width: 120px; flex: 1; }
        .sel-wrap select {
            appearance: none; width: 100%; height: 34px; padding: 0 2rem 0 0.75rem;
            border: 1px solid var(--border); border-radius: var(--radius);
            background: #fff; font-size: 0.875rem; color: var(--foreground); cursor: pointer;
        }
        .sel-icon { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--muted-foreground); width: 14px; height: 14px; }
        .filter-sum { margin-left: auto; font-size: 0.875rem; color: var(--muted-foreground); font-weight: 500; white-space: nowrap; }
        .filter-sum strong { color: var(--foreground); }

        .list-cont { flex: 1; overflow-y: auto; padding: 0 1.5rem 2rem 1.5rem; }
        .list-cont::-webkit-scrollbar { width: 6px; }
        .list-cont::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 4px; }

        .game-group { margin-bottom: 2rem; animation: fadeIn 0.3s ease-out; }
        .game-group:first-child { margin-top: 2rem; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .group-head {
            display: flex; align-items: baseline; justify-content: space-between;
            margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);
        }
        .group-title { font-size: 0.875rem; font-weight: 700; color: var(--foreground); cursor: pointer; }
        .group-title:hover { color: var(--primary); text-decoration: underline; }
        .group-stats { display: flex; gap: 0.75rem; align-items: center; pointer-events: none; user-select: none;}
        .badge-cnt { background: var(--muted); color: var(--muted-foreground); padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
        .badge-dur { font-size: 0.75rem; color: var(--muted-foreground); font-family: var(--font-mono); }

        .vid-card {
            display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem;
            border: 1px solid transparent; border-radius: var(--radius);
            margin-bottom: 0.5rem; transition: 0.2s;
        }
        .vid-card:hover { background: #fafafa; border-color: var(--border); }
        .vid-stats {display: flex; gap: 2px; align-items: center;}
        .row-1 { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .g-name { font-size: 0.8125rem; font-weight: 700; color: var(--primary); }
        .tag-part { background: var(--primary); color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; user-select: none;}
        .tag-end { background: var(--end-tag-bg); color: var(--end-tag-text); border: 1px solid var(--end-tag-border); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; user-select: none;}
        .row-2 { font-size: 0.875rem; color: #4b5563; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .row-2 a { color: inherit; text-decoration: none; }
        .row-2 a:hover { color: var(--primary); }
        .row-3 { display: flex; align-items: center; gap: 1rem; font-size: 0.75rem; color: #9ca3af; font-family: var(--font-mono); }

        .ellipsis-row {
            text-align: center; padding: 0.5rem; color: var(--muted-foreground);
            font-size: 0.875rem; font-style: italic; cursor: pointer; user-select: none;
            background: #fafafa; border-radius: var(--radius); margin: 0.5rem 0; border: 1px dashed var(--border);
        }
        .ellipsis-row:hover { color: var(--primary); border-color: var(--primary); background: #fff; }

        .sentinel { height: 40px; display: flex; align-items: center; justify-content: center; color: var(--muted-foreground); font-size: 0.875rem; margin-top: 1rem; }

        /* Responsive */
        @media (max-width: 768px) {
            aside { width: 70px; }
            .streamer-info, .sidebar-title span, .brand span { display: none; }
            .streamer-item { justify-content: center; padding: 0.8rem 0; }
            .avatar { margin: 0; }
            .sidebar-title { justify-content: center; padding: 1rem 0; }
            .search-bar:focus-within { width: 200px; position: absolute; right: 2rem; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: var(--radius); }
            .search-bar:focus-within .search-input { width: 100%; }
            
            .meta-bar { grid-template-columns: 1fr; gap: 0.75rem; padding: 1rem 1.25rem; }
            .filter-bar { flex-wrap: wrap; padding: 0.75rem 1.25rem; gap: 0.5rem; }
            .sel-wrap { min-width: calc(50% - 0.25rem); }
            .filter-sum { width: 100%; margin-top: 0.25rem; font-size: 0.75rem; text-align: left; }
            .list-cont { padding: 0 1.25rem 2rem 1.25rem; }
            .uploader-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>

    <!-- 1. Global Top Header -->
    <header class="global-header">
        <div class="brand" onclick="window.location.hash='#/'">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
            <span>直播回放索引</span>
        </div>
        <div class="search-bar">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" class="search-input" placeholder="搜索主播..." id="globalSearch">
        </div>
    </header>

    <main class="app-container">
        <!-- Left Sidebar -->
        <aside>
            <div class="sidebar-title"><span>主播列表</span></div>
            <div class="streamer-list" id="streamerList"></div>
        </aside>

        <!-- Right Content -->
        <main class="content-container">
            <!-- View A: Uploader Selection Grid -->
            <div id="viewSelect" class="view-select">
                <div class="empty-state" id="emptyState">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <p>请在左侧选择一位主播<br>查看其录播上传者</p>
                </div>
                
                <div id="selectContent" style="display:none;">
                    <div class="select-header">
                        <h1 id="selectTitle">选择一个主播</h1>
                        <p id="selectSub">从列表中查看相关上传者</p>
                    </div>
                    <div class="uploader-grid" id="uploaderGrid"></div>
                </div>
            </div>

            <!-- View B: Records List Detail -->
            <div id="viewRecords" class="view-records" style="display:none;">
                <div class="rec-header">
                    <div class="page-title">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        <span id="recTitle">录播详情</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn-tool btn-outline" id="backToSelectBtn">
                            <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
                            返回
                        </button>
                        <button class="btn-tool btn-outline" id="resetFilterBtn" title="重置筛选">
                            <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                        </button>
                    </div>
                </div>
                <div class="meta-bar" id="metaBar"></div>
                <div class="filter-bar">
                    <div class="sel-wrap"><select id="yearSelect"></select><svg class="sel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></div>
                    <div class="sel-wrap"><select id="monthSelect"></select><svg class="sel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></div>
                    <div class="sel-wrap"><select id="gameSelect"></select><svg class="sel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></div>
                    <div class="filter-sum" id="filterSum">加载中...</div>
                </div>
                <div class="list-cont" id="listContainer">
                    <div class="sentinel" id="sentinel"><span id="sentinelText">向下滚动加载更多</span></div>
                </div>
            </div>
        </main>
    </main>

    <script type="module">
        const streamerRecords = ${ JSON.stringify( streamerRecords ) };

        // State
        let currentStreamerIndex = null;
        let filteredGroups = [];
        let currentBatchIndex = 0;
        const BATCH_SIZE = 5;
        let observer = null;
        let currentUploaderData = null;

        // DOM
        const streamerListEl = document.getElementById('streamerList');
        const viewSelect = document.getElementById('viewSelect');
        const viewRecords = document.getElementById('viewRecords');
        const emptyState = document.getElementById('emptyState');
        const selectContent = document.getElementById('selectContent');
        const selectTitle = document.getElementById('selectTitle');
        const selectSub = document.getElementById('selectSub');
        const uploaderGrid = document.getElementById('uploaderGrid');
        const recTitle = document.getElementById('recTitle');
        const backToSelectBtn = document.getElementById('backToSelectBtn');
        const resetFilterBtn = document.getElementById('resetFilterBtn');
        const metaBarEl = document.getElementById('metaBar');
        const listContainerEl = document.getElementById('listContainer');
        const sentinelEl = document.getElementById('sentinel');
        const yearSelect = document.getElementById('yearSelect');
        const monthSelect = document.getElementById('monthSelect');
        const gameSelect = document.getElementById('gameSelect');
        const filterSumEl = document.getElementById('filterSum');
        const globalSearch = document.getElementById('globalSearch');

        // Helpers
        const formatDate = (ts) => new Date(ts).toISOString().split('T')[0];
        const formatDuration = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return \`$\{ h.toString().padStart( 2, '0' ) }:$\{ m.toString().padStart( 2, '0' ) }:$\{ s.toString().padStart( 2, '0' ) }\`;
        };
        const getYear = (ts) => new Date(ts).getFullYear();
        const getMonth = (ts) => new Date(ts).getMonth() + 1;

        // --- ROUTING ---
        function handleRoute() {
            const hash = window.location.hash;
            const match = hash.match(/liver\\/([^\\/]+)\\/uploader\\/([^\\/]+)/);
            
            if (match) {
                const liver = decodeURIComponent(match[1]);
                const uploader = decodeURIComponent(match[2]);
                showRecordsView(liver, uploader);
            } else {
                showSelectView();
            }
        }

        function showSelectView() {
            viewSelect.style.display = 'flex';
            viewRecords.style.display = 'none';
            renderStreamerList();
            renderUploaderGrid();
        }

        function showRecordsView(liver, uploader) {
            const streamer = streamerRecords.find(s => s.liver === liver);
            if (!streamer) { nagigateToIndex(); return; }
            
            const uploaderData = streamer.uploaders.find(u => u.userName === uploader);
            if (!uploaderData || uploaderData.records.length === 0) {
                alert("暂无数据"); nagigateToIndex(); return;
            }

            currentStreamerIndex = streamerRecords.indexOf(streamer);
            currentUploaderData = uploaderData;
            renderStreamerList(); // Update active

            viewSelect.style.display = 'none';
            viewRecords.style.display = 'flex';
            recTitle.textContent = liver === uploader
                ? \`$\{ liver }\`
                : \`$\{ liver } · $\{ uploader }\`;
            
            initRecordsView(uploaderData);
        }

        // --- SIDEBAR ---
        function renderStreamerList() {
            streamerListEl.innerHTML = '';
\t        streamerRecords.forEach((item, index) => {
                const isActive = currentStreamerIndex === index;
                const div = document.createElement('div');
                div.className = \`streamer-item $\{ isActive ? 'active' : '' }\`;
                div.onclick = () => {
                    currentStreamerIndex = index;
                    renderStreamerList();
                    renderUploaderGrid();
                    nagigateToIndex()
                    // Update URL to reflect selection but stay on grid view?
                    // Or just update UI. Let's just update UI for grid view.
                };
                div.innerHTML = \`
                    <div class="avatar">$\{ item.liver.slice( 0, 2 ).toUpperCase() }</div>
                    <div class="streamer-info">
                        <div class="s-name">$\{ item.liver }</div>
                        <div class="s-meta">$\{ item.uploaders.length } 位上传者</div>
                    </div>
                \`;
                streamerListEl.appendChild(div);
            });
        }

        // --- SELECT VIEW (GRID) ---
        function renderUploaderGrid() {
            uploaderGrid.innerHTML = '';
            if (currentStreamerIndex === null) {
                emptyState.style.display = 'flex';
                selectContent.style.display = 'none';
                return;
            }
            emptyState.style.display = 'none';
            selectContent.style.display = 'block';
            
            const streamer = streamerRecords[currentStreamerIndex];
            selectTitle.textContent = \`$\{ streamer.liver } 的录播上传者\`;
            selectSub.textContent = \`共找到 $\{ streamer.uploaders.length } 个上传者账号\`;

            streamer.uploaders.forEach(uploader => {
                const card = document.createElement('div');
                card.className = 'card';
                card.onclick = () => navigateToRecords(streamer.liver, uploader.userName);
                
                // REQ 3: Badge Text "本人"
                const badgeHtml = uploader.isSelf
                    ? \`<span class="badge-self">本人</span>\`
                    : \`<span class="badge-other">第三方</span>\`;
                
                card.innerHTML = \`
                    <div class="card-head"><div class="card-title">$\{ uploader.userName }</div>$\{ badgeHtml }</div>
                    <div class="card-stats">
                        <div class="stat-item"><span class="stat-label">最新录播</span><span class="stat-val">$\{ formatDate( uploader.newestTime ) }</span></div>
                        <div class="stat-item"><span class="stat-label">最早录播</span><span class="stat-val">$\{ formatDate( uploader.oldestTime ) }</span></div>
                        <div class="stat-item"><span class="stat-label">数据更新</span><span class="stat-val mono">$\{ formatDate( uploader.latestUpdate ) }</span></div>
                        <div class="stat-item"><span class="stat-label">累计视频</span><span class="stat-val mono">$\{ uploader.totalVideos }</span></div>
                    </div>
                    <div class="card-foot">
                        <button class="btn-enter" onclick="event.stopPropagation(); navigateToRecords('$\{ streamer.liver }', '$\{ uploader.userName }')">进入查看 <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>
                    </div>
                \`;
                uploaderGrid.appendChild(card);
            });
        }

        function nagigateToIndex() {
             window.location.hash = '/'
        }
        function navigateToRecords(liver, uploader) {
            window.location.hash = \`/liver/$\{ encodeURIComponent( liver ) }/uploader/$\{ encodeURIComponent( uploader ) }\`;
        }

        // --- RECORDS VIEW LOGIC ---
        function initRecordsView(data) {
            renderMeta(data);
            initFilters(data.records);
            setupObserver();
            applyFiltersAndRender(true);
            
            backToSelectBtn.onclick = () => {
                // Go back to grid view for this streamer
                const liver = data.records[0].liver;
                // We need to find the streamer index to keep sidebar state
                const sIdx = streamerRecords.findIndex(s => s.liver === liver);
                if(sIdx !== -1) currentStreamerIndex = sIdx;
                renderStreamerList();
                nagigateToIndex(); // Triggers showSelectView
            };
            
            resetFilterBtn.onclick = () => {
                yearSelect.value = ""; monthSelect.selectedIndex = 0; gameSelect.value = "";
                applyFiltersAndRender(true);
            };
            yearSelect.onchange = () => { updateMonthOptions(); applyFiltersAndRender(true); };
            monthSelect.onchange = () => applyFiltersAndRender(true);
            gameSelect.onchange = () => applyFiltersAndRender(true);
        }

        function renderMeta(data) {
            const recs = data.records;
            const sortedByTime = [...recs].sort((a,b) => a.liveTime - b.liveTime);
            const oldest = sortedByTime[0];
            const newest = sortedByTime[sortedByTime.length - 1];
            
            metaBarEl.innerHTML = \`
                <div class="meta-item"><span class="meta-label">主播</span><span class="meta-val">$\{ recs[ 0 ].liver }</span></div>
                <div class="meta-item"><span class="meta-label">上传者</span><span class="meta-val">$\{ data.userName }</span></div>
                <div class="meta-item"><span class="meta-label">数据更新</span><span class="meta-val">$\{ formatDate( data.latestUpdate ) }</span></div>
                <div class="meta-item"><span class="meta-label">累计视频</span><span class="meta-val tabular-nums">$\{ recs.length } 部</span></div>
                <div class="meta-item"><span class="meta-label">最旧视频</span><a target="_blank" href="https://www.bilibili.com/video/av$\{ oldest.aid }" class="meta-link truncate">$\{ formatDate( oldest.liveTime ) } $\{ oldest.title }</a></div>
                <div class="meta-item"><span class="meta-label">最新视频</span><a target="_blank" href="https://www.bilibili.com/video/av$\{ newest.aid }" class="meta-link truncate">$\{ formatDate( newest.liveTime ) } $\{ newest.title }</a></div>
            \`;
        }

        function initFilters(recs) {
            const years = [...new Set(recs.map(r => getYear(r.liveTime)))].sort((a,b) => b-a);
            yearSelect.innerHTML = \`<option value="">全部年份</option>\` + years.map(y => \`<option value="$\{ y }">$\{ y }年</option>\`).join('');
            updateMonthOptions();
            const allGames = [...new Set(recs.flatMap(r => r.playGame))].sort();
            gameSelect.innerHTML = \`<option value="">全部游戏</option>\` + allGames.map(g => \`<option value="$\{ g }">$\{ g }</option>\`).join('');
        }

        function updateMonthOptions() {
            const year = yearSelect.value;
            const recs = currentUploaderData.records;
            let months = year ? [...new Set(recs.filter(r => getYear(r.liveTime) == year).map(r => getMonth(r.liveTime)))].sort((a,b) => b-a)
                              : [...new Set(recs.map(r => getMonth(r.liveTime)))].sort((a,b) => b-a);
            const monthNames = ["","一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
            monthSelect.innerHTML = \`<option value="">$\{ year ? "全部月份" : "全年" }</option>\` + months.map(m => \`<option value="$\{ m }">$\{ monthNames[ m ] }</option>\`).join('');
        }

        function applyFiltersAndRender(reset = false) {
            const year = yearSelect.value;
            const month = monthSelect.value;
            const game = gameSelect.value;
            const recs = currentUploaderData.records;

            monthSelect.disabled = Boolean(!year)

            let filteredRecs = recs.filter(r => {
                if (year && getYear(r.liveTime) !== Number(year)) return false;
                if (month && getMonth(r.liveTime) !== Number(month)) return false;
                if (game && !r.playGame.includes(game)) return false;
                return true;
            });

            const groupMap = new Map();
            filteredRecs.forEach(r => {
                r.playGame.forEach(g => {
                    if (game && g !== game) return;
                    if (!groupMap.has(g)) groupMap.set(g, []);
                    groupMap.get(g).push(r);
                });
            });

            let groups = [];
            if (game) {
                if (groupMap.has(game)) groups = [{ name: game, items: groupMap.get(game) }];
            } else {
                groups = Array.from(groupMap.entries()).map(([name, items]) => ({
                    name, items, maxTime: Math.max(...items.map(i => i.liveTime))
                })).sort((a, b) => b.maxTime - a.maxTime);
            }
            
            groups.forEach(g => g.items.sort((a, b) => a.liveTime - b.liveTime));
            filteredGroups = groups;

			const filteredGameList = filteredRecs.flatMap((r) => r.playGame)
			
            const totalDuration = filteredRecs.reduce((acc, r) => acc + r.liveDuration, 0);
            let summaryText = \`共 $\{ filteredGameList.length } 集 · 总时长 $\{ formatDuration( totalDuration ) }\`;
            if (year) summaryText = \`$\{ year }年 · $\{ filteredGameList.length } 集\`;
            if (year && month) summaryText = \`$\{ year }年$\{ month }月 · $\{ filteredGameList.length } 集\`;
            if (game) summaryText = \`$\{ game } · $\{ filteredGroups[0].items.length } 集\`;
            filterSumEl.innerHTML = summaryText;

            if (reset) {
                currentBatchIndex = 0;
                Array.from(listContainerEl.children).forEach(c => { if (c !== sentinelEl) listContainerEl.removeChild(c); });
                if (observer) observer.observe(sentinelEl);
                loadNextBatch();
            }
        }

        function loadNextBatch() {
            if (currentBatchIndex >= filteredGroups.length) {
                document.getElementById('sentinelText').textContent = "没有更多记录了";
                if (observer) observer.unobserve(sentinelEl);
                return;
            }
            const batch = filteredGroups.slice(currentBatchIndex, currentBatchIndex + BATCH_SIZE);
            const isFiltered = !!yearSelect.value || !!monthSelect.value || !!gameSelect.value;

            batch.forEach(group => {
                const groupEl = document.createElement('div');
                groupEl.className = 'game-group';
                const totalDur = group.items.reduce((acc, i) => acc + i.liveDuration, 0);
                const shouldCollapse = !isFiltered && group.items.length > 10;
                const totalItems = group.items.length;
                
                let cardsHtml = '';

                const renderItem = (item, actualIndex) => {
                    const partNum = item._globalPartMap[group.name];
                    const isLast = actualIndex === totalItems - 1;
                    return \`
                        <div class="vid-card">
                            <div class="row-1">
                                <span class="g-name">$\{ group.name }</span>
                                <span class="tag-part">Part $\{ partNum }</span>
                                $\{ isLast ? '<span class="tag-end">END</span>' : '' }
                            </div>
                            <div class="row-2"><a href="https://www.bilibili.com/video/av$\{ item.aid }" target="_blank">$\{ item.title }</a></div>
                            <div class="row-3">
                                <section class="vid-stats">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span>$\{ formatDate( item.liveTime ) }</span>
                                </section>
                                <section class="vid-stats">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                    <span class="tabular-nums">$\{ formatDuration( item.liveDuration ) }</span>
                                </section>
                                <section class="vid-stats">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                    </svg>
                                    <span class="tabular-nums">av$\{ item.aid }</span>
                                </section>
                            </div>
                        </div>
                    \`;
                };

                if (shouldCollapse) {
                    for(let i=0; i<3; i++) cardsHtml += renderItem(group.items[i], i);
                    cardsHtml += \`<div class="ellipsis-row" onclick="toggleExpand('$\{ group.name }', $\{ totalItems })">... 隐藏了 $\{ totalItems - 6 } 条记录 (点击展开) ...</div>\`;
                    for(let i=totalItems-3; i<totalItems; i++) cardsHtml += renderItem(group.items[i], i);
                } else {
                    for(let i=0; i<totalItems; i++) cardsHtml += renderItem(group.items[i], i);
                }

                groupEl.innerHTML = \`
                    <div class="group-head">
                        <span class="group-title" onclick="filterByGame('$\{ group.name }')">$\{ group.name }</span>
                        <div class="group-stats"><span class="badge-cnt">$\{ totalItems }集</span><span class="badge-dur tabular-nums">$\{ formatDuration( totalDur ) }</span></div>
                    </div>
                    <div class="group-body" id="group-body-$\{ group.name.replace( /\s/g, '' ) }">$\{ cardsHtml }</div>
                \`;
                listContainerEl.insertBefore(groupEl, sentinelEl);
            });
            currentBatchIndex += BATCH_SIZE;
        }

        window.filterByGame = (gameName) => {
            gameSelect.value = gameName;
            yearSelect.value = "";
            monthSelect.selectedIndex = 0;
            applyFiltersAndRender(true);
            listContainerEl.scrollTop = 0;
        };

        window.toggleExpand = (gameName, totalItems) => {
            const container = document.getElementById(\`group-body-$\{ gameName.replace( /\s/g, '' ) }\`);
            if (!container) return;
            const group = filteredGroups.find(g => g.name === gameName);
            if (!group) return;
            let fullHtml = '';
            group.items.forEach((item, idx) => {
                const partNum = item._globalPartMap[group.name];
                const isLast = idx === totalItems - 1;
                fullHtml += \`
                    <div class="vid-card">
                        <div class="row-1">
                            <span class="g-name">$\{ group.name }</span>
                            <span class="tag-part">Part $\{ partNum }</span>
                            $\{ isLast ? '<span class="tag-end">END</span>' : '' }
                        </div>
                        <div class="row-2"><a href="https://www.bilibili.com/video/av$\{ item.aid }" target="_blank">$\{ item.title }</a></div>
                        <div class="row-3">
                            <section class="vid-stats">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                <span>$\{ formatDate( item.liveTime ) }</span>
                            </section>
                            <section class="vid-stats">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <span class="tabular-nums">$\{ formatDuration( item.liveDuration ) }</span>
                            </section>
                            <section class="vid-stats">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                                <span class="tabular-nums">av$\{ item.aid }</span>
                            </section>
                        </div>
                    </div>
                \`;
            });
            container.innerHTML = fullHtml;
        };

        function setupObserver() {
            if ('IntersectionObserver' in window) {
                observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) loadNextBatch();
                }, { root: listContainerEl, threshold: 0.2 });
                observer.observe(sentinelEl);
            }
        }

        // Search Filter Logic (Sidebar)
        globalSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = streamerListEl.querySelectorAll('.streamer-item');
            items.forEach(item => {
                const name = item.querySelector('.s-name').textContent.toLowerCase();
                item.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });

        // Init
        window.addEventListener('hashchange', handleRoute);
        handleRoute();

    </script>
</body>
</html>
`
}
