'use strict';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'searchPT') {
        const url = request.url;
        
        if (!url || typeof url !== 'string') {
            sendResponse({ success: false, error: 'Invalid URL parameter' });
            return false;
        }
        
        if (!url.startsWith('https://pt.sjtu.edu.cn/')) {
            sendResponse({ success: false, error: 'URL must be from pt.sjtu.edu.cn domain' });
            return false;
        }
        
        fetch(url, {
            method: 'GET',
            credentials: 'include'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(html => {
                sendResponse({ success: true, html: html });
            })
            .catch(error => {
                console.error('[DoubanPT Background] Error:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message || 'Network request failed' 
                });
            });
        
        return true;
    }
    
    return false;
});
