// ==UserScript==
// @name         Douban PT Connector
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Search pt.sjtu.edu.cn for resources when visiting Douban movie pages.
// @author       Antigravity
// @match        https://movie.douban.com/subject/*
// @grant        GM_xmlhttpRequest
// @connect      pt.sjtu.edu.cn
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const PT_DOMAIN = 'pt.sjtu.edu.cn';
    const PT_SEARCH_URL = `https://${PT_DOMAIN}/torrents.php`;

    // Helpers
    function log(msg) {
        console.log(`[DoubanPT] ${msg}`);
    }

    // 1. Extract Movie Name
    function getMovieName() {
        const titleNode = document.querySelector('h1 > span[property="v:itemreviewed"]');
        if (!titleNode) {
            log('Movie title node not found.');
            return null;
        }

        const fullTitle = titleNode.innerText.trim();
        // Logic: "ChineseName ForeignName" -> take "ChineseName"
        // Splitting by space might be too aggressive if the Chinese name has spaces, but usually it doesn't.
        // Let's take the first part of the split.
        const chineseName = fullTitle.split(' ')[0];
        log(`Extracted text: "${fullTitle}" -> Suggest Search: "${chineseName}"`);
        return chineseName;
    }

    // 2. UI Injection
    function createContainer() {
        const aside = document.querySelector('div.aside');
        if (!aside) {
            log('Sidebar (.aside) not found.');
            return null;
        }

        const container = document.createElement('div');
        container.className = 'gray_ad douban-pt-container';
        container.innerHTML = `
            <h2>
                PT Resources
                &nbsp;·&nbsp;·&nbsp;·&nbsp;·&nbsp;·&nbsp;·
            </h2>
            <ul class="bs" id="douban-pt-list" style="margin-bottom: 0;">
                <li style="border: none; padding: 10px 0; color: #666;">
                    Loading...
                </li>
            </ul>
        `;

        // Insert as the first item in aside, or append?
        // Douban usually puts "Where to watch" near the top.
        // Let's try to insert after the first element or just prepend.
        if (aside.firstChild) {
            aside.insertBefore(container, aside.firstChild);
        } else {
            aside.appendChild(container);
        }

        return container;
    }

    function updateSubtitle(count) {
        const h2 = document.querySelector('.douban-pt-container h2');
        if(h2) {
             h2.innerHTML = `
                PT Resources (${count})
                &nbsp;·&nbsp;·&nbsp;·&nbsp;·&nbsp;·&nbsp;·
            `;
        }
    }

    function renderResults(results) {
        const listContainer = document.getElementById('douban-pt-list');
        if (!listContainer) return;

        listContainer.innerHTML = ''; // Clear loading state

        if (results.length === 0) {
            listContainer.innerHTML = `
                <li style="border: none; padding: 10px 0; color: #666;">
                    No resources found.
                </li>`;
            return;
        }

        updateSubtitle(results.length);

        results.slice(0, 5).forEach(item => { // Show top 5
            const li = document.createElement('li');
            li.style.borderBottom = '1px dashed #ddd';
            li.style.padding = '8px 0';
            li.style.overflow = 'hidden';

            li.innerHTML = `
                <div style="float: left; width: 70%;">
                     <a href="${item.link}" target="_blank" title="${item.fullTitle}"
                        style="display: block; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${item.title}
                     </a>
                </div>
                <div style="float: right; width: 30%; text-align: right; color: #999; font-size: 12px;">
                    ${item.size}
                </div>
                <div style="clear: both;"></div>
            `;
            listContainer.appendChild(li);
        });

        if (results.length > 5) {
             const li = document.createElement('li');
             li.style.textAlign = 'right';
             li.style.paddingTop = '5px';
             li.innerHTML = `<a href="${currentSearchUrl}" target="_blank">See all ${results.length} results &raquo;</a>`;
             listContainer.appendChild(li);
        }
    }

    function renderError(msg) {
        const listContainer = document.getElementById('douban-pt-list');
        if (listContainer) {
            listContainer.innerHTML = `
                <li style="border: none; padding: 10px 0; color: #f44336;">
                    ${msg}
                </li>`;
        }
    }

    // 3. Search & Parse
    let currentSearchUrl = '';

    function parseResponse(responseText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(responseText, 'text/html');
        const rows = doc.querySelectorAll('table.torrents > tbody > tr');
        const results = [];

        // Rows usually: header, then data.
        // Need to inspect the structure of pt.sjtu.edu.cn torrents table.
        // Assumption: typical NexusPHP structure.
        // Row check: has class 'sticky' or just trs.
        // Columns often: Type, Name, DL, Comments, Time, Size, Seeders, Leechers, Completed

        rows.forEach(row => {
            // Skip header if typical header class (often 'colhead')
            if (row.querySelector('td.colhead')) return;

            const tds = row.querySelectorAll('td');
            if (tds.length < 5) return;

            // This is a heuristic guess for standard NexusPHP.
            // Adjust indices based on actual site structure if needed.
            // Usually Title is in the 2nd cell (index 1).
            const titleLink = tds[1].querySelector('a[href^="details.php"]');
            if (!titleLink) return;

            // Size usually around index 4 or 5
            // Let's iterate to find size-like text if unsure, or pin it if we know NexusPHP.
            // NexusPHP standard: Type, Name, (actions), Time, Size, S/L...
            
            // Let's try to grab Size by regex from simple text content of likely cells?
            // Or look for specific cells.
            // Let's grab the link and raw text for now.
            
            // For robustness without seeing the exact DOM:
            // Find the cell with the size (e.g., "1.2 GB")
            let size = 'N/A';
            // Size is often 5th td (index 4)
            if (tds[4]) size = tds[4].innerText.trim();

            const title = titleLink.title || titleLink.innerText.trim();
            const link = `https://${PT_DOMAIN}/${titleLink.getAttribute('href')}`;

            results.push({
                title: title,
                fullTitle: title, // Store full for tooltip
                link: link,
                size: size
            });
        });

        return results;
    }

    function searchPT(keyword) {
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
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const results = parseResponse(response.responseText);
                        log(`Found ${results.length} results.`);
                        renderResults(results);
                    } catch (e) {
                        console.error(e);
                        renderError('Error parsing results.');
                    }
                } else {
                    renderError(`Network error: ${response.status}`);
                }
            },
            onerror: function(err) {
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
