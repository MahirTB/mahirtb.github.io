/**
 * Checks if the site is running locally (development mode).
 * If so, enables admin features like the Editor link and Delete buttons.
 */
const isAdmin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Toggle the "+" Editor Link
    const editorLink = document.getElementById('editor-link');
    if (editorLink) {
        editorLink.style.display = isAdmin ? '' : 'none';
        // Ensure opacity is reset if it was set inline
        if (isAdmin) editorLink.style.opacity = '1';
    }
});
