# Douban PT Connector

A Userscript that seamlessly integrates **PT SJTU** resources into **Douban Movie** pages.

When you visit a movie page on Douban, this script automatically searches for relevant torrents on `pt.sjtu.edu.cn` and displays them in a neat table within the sidebar.

## Features

*   **Automatic Search**: Extracts the Chinese movie name from Douban and searches PT SJTU in the background.
*   **Integrated Display**: Shows results directly on the Douban page sidebar.
*   **Smart Sorting**: Prioritizes torrents with active seeders.
*   **Direct Access**: One-click download from the list or jump to the full search results page.
*   **Privileged Access**: Uses your existing browser session (cookies) to access the PT site securely.

## Installation

1.  **Install a Userscript Manager**:
    *   [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Safari, Firefox)
    *   [Violentmonkey](https://violentmonkey.github.io/) (Open Source)

2.  **Install the Script**:
    *   Create a new script in your manager.
    *   Copy the content of [douban_pt.user.js](./douban_pt.user.js).
    *   Save the script.

## Usage

1.  **Login**: Ensure you are logged into [pt.sjtu.edu.cn](https://pt.sjtu.edu.cn) in the same browser.
2.  **Browse**: Visit any movie subject page on [movie.douban.com](https://movie.douban.com).
3.  **View**: Look for the **"PT Resources"** block in the sidebar.

## Troubleshooting

*   **Network Error**: Make sure you are logged into the PT site. The script cannot bypass login requirements.
*   **No Results**: The script searches using the primary Chinese title. If the PT site uses a different naming convention, it might miss some results. Click the "PT Resources" title to open the manual search page.

## License

MIT
