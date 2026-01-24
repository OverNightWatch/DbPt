// ==UserScript==
// @name         Douban PT Connector
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Search pt.sjtu.edu.cn for resources when visiting Douban movie pages.
// @author       Antigravity
// @match        https://movie.douban.com/subject/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      pt.sjtu.edu.cn
// ==/UserScript==

(function () {
    'use strict';

    // Configuration
    const PT_DOMAIN = 'pt.sjtu.edu.cn';
    const PT_BASE_URL = `https://${PT_DOMAIN}`;
    const PT_SEARCH_URL = `${PT_BASE_URL}/torrents.php`;
    let currentSearchUrl = '';

    // Helpers
    function log(msg) {
        console.log(`[DoubanPT] ${msg}`);
    }

    // Styles
    GM_addStyle(`
        .douban-pt-container { margin-bottom: 20px; overflow-x: auto; }
        .douban-pt-container h2 { color: #007722; font-size: 16px; margin-bottom: 12px; }
        .pt-table { width: 100%; border-collapse: collapse; border: 1px solid #ddd; font-size: 13px; min-width: 600px; } /* Ensure table doesn't collapse too much */
        .pt-table td { padding: 5px; border: 1px solid #ddd; vertical-align: middle; }
        .pt-table .rowfollow { background-color: #f9f9f9; }
        .pt-table .colhead { background-color: #eee; font-weight: bold; text-align: center; }
        .pt-table .embedded { border: none; padding: 0; text-align: left; }
        .pt-table .embedded b { font-size: 14px; }
        .pt-table img { vertical-align: middle; }
        .pt-table .red { color: red; }
        .pt-table a { color: #37a; text-decoration: none; }
        .pt-table a:hover { text-decoration: underline; }
    `);

    // 1. Extract Movie Name
    function getMovieName() {
        const titleNode = document.querySelector('h1 > span[property="v:itemreviewed"]');
        if (!titleNode) {
            log('Movie title node not found.');
            return null;
        }

        const fullTitle = titleNode.innerText.trim();
        // Logic: "ChineseName ForeignName" -> take "ChineseName"
        const chineseName = fullTitle.split(' ')[0];
        log(`Extracted text: "${fullTitle}" -> Suggest Search: "${chineseName}"`);
        return chineseName;
    }

    // 2. UI Injection
    function createContainer() {
        // Inject into sidebar (.aside) as requested
        const aside = document.querySelector('div.aside');
        if (!aside) {
            log('Sidebar (.aside) not found.');
            return null;
        }

        const container = document.createElement('div');
        container.className = 'douban-pt-container';
        container.innerHTML = `
            <h2>
                <i>PT Resources</i>
                &nbsp;·&nbsp;·&nbsp;·&nbsp;·&nbsp;·&nbsp;·
            </h2>
            <div id="douban-pt-content">
                Loading...
            </div>
        `;

        // Insert as the first item in aside
        if (aside.firstChild) {
            aside.insertBefore(container, aside.firstChild);
        } else {
            aside.appendChild(container);
        }

        return container;
    }

    function renderResults(results) {
        const contentDiv = document.getElementById('douban-pt-content');
        if (!contentDiv) return;

        contentDiv.innerHTML = '';

        if (results.length === 0) {
            contentDiv.innerHTML = '<div style="padding:10px; color:#666;">No resources found.</div>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'pt-table';

        // No Header requested
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        results.slice(0, 10).forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'rowfollow';

            const catImgUrl = item.catImg ? (item.catImg.startsWith('http') ? item.catImg : `${PT_BASE_URL}/${item.catImg}`) : '';

            tr.innerHTML = `
                <td align="center" style="width: 30px;">
                    <a href="${item.dlLink}" target="_blank" title="Click to Download">
                        <img src="${catImgUrl}" alt="DL" style="max-width: 24px; max-height: 24px;">
                    </a>
                </td>
                <td align="center" style="width: 40px;">
                    <span class="red" style="font-weight: bold;">${item.seeds}</span>
                </td>
                <td align="left">
                    <a href="${item.link}" target="_blank" title="${item.fullTitle}" style="font-weight: bold; color: #37a;">
                        ${item.title}
                    </a>
                </td>
            `;
            tbody.appendChild(tr);
        });

        contentDiv.appendChild(table);

        // Update header count
        const h2 = document.querySelector('.douban-pt-container h2');
        if (h2) {
            h2.innerHTML = `<i><a href="${currentSearchUrl}" target="_blank" style="color: #007722;">PT Resources</a> (${results.length})</i>&nbsp;·&nbsp;·&nbsp;·&nbsp;·&nbsp;·&nbsp;·`;
        }
    }

    function renderError(msg) {
        const contentDiv = document.getElementById('douban-pt-content');
        if (contentDiv) {
            contentDiv.innerHTML = `<div style="padding:10px; color:red;">${msg}</div>`;
        }
    }

    // 3. Search & Parse
    function parseResponse(responseText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(responseText, 'text/html');
        const rows = doc.querySelectorAll('table.torrents > tbody > tr');
        const results = [];

        rows.forEach(row => {
            // Skip header/footer rows (headers usually have class 'colhead', footers empty)
            // Valid rows usually have class 'rowfollow' or similar
            const tds = row.querySelectorAll('td');
            if (tds.length < 5) return;

            // Check if it's a real torrent row
            if (!row.querySelector('table.torrentname')) return;

            // 1. Title & Subtitle within nested table
            const titleTable = row.querySelector('table.torrentname');
            const titleLink = titleTable.querySelector('a[href^="details.php"]');
            if (!titleLink) return;

            const fullTitle = titleLink.title || titleLink.innerText.trim();
            const link = `${PT_BASE_URL}/${titleLink.getAttribute('href')}`;

            // Download Link
            const dlNode = titleTable.querySelector('a[href^="download.php"]');
            const dlLink = dlNode ? `${PT_BASE_URL}/${dlNode.getAttribute('href')}` : '#';

            // Subtitle
            const embeddedTd = titleTable.querySelector('td.embedded');
            let subtitle = '';
            if (embeddedTd) {
                const clone = embeddedTd.cloneNode(true);
                const b = clone.querySelector('b');
                if (b) b.remove();
                subtitle = clone.innerText.trim();
            }

            // 0. Category
            const catImgNode = tds[0].querySelector('img');
            const catImg = catImgNode ? catImgNode.getAttribute('src') : '';
            const catAlt = catImgNode ? catImgNode.getAttribute('alt') : '';

            // Columns 
            const comments = tds[2] ? tds[2].innerText.trim() : '0';
            const timeNode = tds[3].querySelector('span');
            const timePretty = timeNode ? timeNode.innerText.trim() : (tds[3] ? tds[3].innerText.trim() : '');
            const timeFull = timeNode ? timeNode.getAttribute('title') : '';

            const size = tds[4] ? tds[4].innerText.trim() : '';

            // Seeds extraction (User requested specific target)
            // Look for a link with toseeders=1 inside the row
            const seedLink = row.querySelector('a[href*="toseeders=1"]');
            const seeds = seedLink ? seedLink.innerText.trim() : (tds[5] ? tds[5].innerText.trim() : '-');

            const leechers = tds[6] ? tds[6].innerText.trim() : '';
            const completed = tds[7] ? tds[7].innerText.trim() : '';

            const uploaderNode = tds[8] ? tds[8].querySelector('a') : null;
            const uploader = uploaderNode ? uploaderNode.innerText.trim() : (tds[8] ? tds[8].innerText.trim() : '');

            results.push({
                title: fullTitle,
                fullTitle: fullTitle,
                link: link,
                dlLink: dlLink,
                subtitle: subtitle,
                catImg: catImg,
                catAlt: catAlt,
                comments: comments,
                timePretty: timePretty,
                timeFull: timeFull,
                size: size,
                seeds: seeds,
                leechers: leechers,
                completed: completed,
                uploader: uploader
            });
        });

        return results;
    }

    function searchPT(keyword) {
        // Query paramaters
        const params = new URLSearchParams({
            incldead: 0,
            spstate: 0,
            inclbookmarked: 0,
            picktype: 0,
            search: keyword,
            search_area: 0,
            search_mode: 0
        });

        const url = `${PT_SEARCH_URL}?${params.toString()}`;
        currentSearchUrl = url;
        log(`Searching: ${url}`);

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function (response) {
                if (response.status === 200) {
                    try {
                        const results = parseResponse(response.responseText);

                        // Sort by seeds descending
                        results.sort((a, b) => {
                            const seedA = parseInt(a.seeds) || 0;
                            const seedB = parseInt(b.seeds) || 0;
                            return seedB - seedA;
                        });

                        log(`Found ${results.length} results.`);
                        renderResults(results);
                    } catch (e) {
                        console.error(e);
                        renderError('Error parsing results: ' + e.message);
                    }
                } else {
                    renderError(`Network error: ${response.status}`);
                }
            },
            onerror: function (err) {
                console.error(err);
                renderError('Request failed.');
            }
        });
    }

    // Main Execution
    const movieName = getMovieName();
    if (movieName) {
        createContainer();
        searchPT(movieName);
    }

})();
