// Global ID variable
let currentId = null;

// Initialize Editor
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'blog'; // default
    const id = urlParams.get('id');

    // Set type select
    const typeSelect = document.getElementById('type');
    if (typeSelect) typeSelect.value = type;

    if (id) {
        currentId = id;
        document.getElementById('status').innerText = "Loading...";
        try {
            const response = await fetch(`data/${type}s.json?t=${new Date().getTime()}`);
            const data = await response.json();
            const item = data.find(i => String(i.id) === id);

            if (item) {
                document.getElementById('title').value = item.title;
                document.getElementById('summary').value = item.summary;
                document.getElementById('editor').innerHTML = item.content;
                if (item.thumbnail) {
                    document.getElementById('selectedThumbnail').value = item.thumbnail;
                }
                document.getElementById('status').innerText = "Editing: " + item.title;

                // Disable type switching during edit to avoid complexity
                typeSelect.disabled = true;
            } else {
                alert('Item not found');
            }
        } catch (e) {
            console.error(e);
            alert('Error loading item');
        }
    }

    // Initialize Toolbar & Thumbnail Picker
    initToolbar();
    initThumbnailPicker();
    updateThumbnailGallery();
});

function initToolbar() {
    const toolbar = document.querySelector('.toolbar');
    const editor = document.getElementById('editor');

    if (!toolbar || !editor) return;

    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-command]');
        if (!btn) return;

        const command = btn.getAttribute('data-command');
        let value = btn.getAttribute('data-value') || null;

        if (command === 'createLink') {
            value = prompt('Enter URL:');
            if (!value) return;
        }

        document.execCommand(command, false, value);
        editor.focus();
        updateToolbarState();
    });

    // Update toolbar on selection change
    document.addEventListener('selectionchange', updateToolbarState);
    editor.addEventListener('keyup', updateToolbarState);
    editor.addEventListener('mouseup', updateToolbarState);
}

function updateToolbarState() {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;

    const buttons = toolbar.querySelectorAll('button[data-command]');
    buttons.forEach(btn => {
        const command = btn.getAttribute('data-command');
        const value = btn.getAttribute('data-value');

        let isActive = false;
        try {
            if (value) {
                // For formatBlock like H3
                isActive = document.queryCommandValue(command) === value || 
                           document.queryCommandValue(command).toLowerCase() === value.replace(/[<>]/g, '').toLowerCase();
            } else {
                isActive = document.queryCommandState(command);
            }
        } catch (e) {}

        if (isActive) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

document.getElementById('saveBtn').addEventListener('click', async () => {
    const saveBtn = document.getElementById('saveBtn');
    const type = document.getElementById('type').value;
    const title = document.getElementById('title').value;
    const summary = document.getElementById('summary').value;
    const content = document.getElementById('editor').innerHTML;
    const statusEl = document.getElementById('status');

    if (!title) {
        alert('Please enter a title');
        return;
    }

    // Disable button to prevent double-submit
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    const selectedThumb = document.getElementById('selectedThumbnail') ? document.getElementById('selectedThumbnail').value : '';

    const payload = {
        type,
        title,
        summary,
        thumbnail: selectedThumb,
        content,
        savedAt: new Date().toISOString()
    };

    // Include ID if editing
    if (currentId) {
        payload.id = currentId;
    }

    try {
        statusEl.textContent = "Saving...";
        const response = await fetch('/save-post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const resData = await response.json();
            statusEl.textContent = "Saved! Redirecting...";

            // Redirect to the post detail view to prevent double-save logic
            // Add 's' to type if needed for plural html file, but we used singular html files (projects.html/blogs.html) in loader logic?
            // Actually our files are projects.html and blogs.html
            // The type value is 'blog' or 'project'
            const destination = (type === 'blog' ? 'blogs' : 'projects') + '.html';

            // Use returned ID from server, or fallback to currentId (edit mode)
            const redirectId = resData.id || currentId;

            setTimeout(() => {
                if (redirectId) {
                    window.location.href = `${destination}?id=${redirectId}`;
                } else {
                    // Fallback to list view if no ID available (unlikely for new posts if server updated, but safe currently)
                    window.location.href = destination;
                }
            }, 1000);
        } else {
            statusEl.textContent = "Error saving.";
            console.error('Server error');
            saveBtn.disabled = false;
            saveBtn.innerText = "Save Content";
        }
    } catch (err) {
        console.error(err);
        statusEl.textContent = "Network error.";
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Content";
    }
});

// Image Upload Handling
document.getElementById('imageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (event) {
        const base64String = event.target.result;

        try {
            const response = await fetch('/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    image: base64String
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Insert image at cursor or at end
                const imgTag = `<img src="${data.url}" style="max-width: 100%; height: auto; margin: 10px 0;">`;
                document.getElementById('editor').focus();
                document.execCommand('insertHTML', false, imgTag);
                updateThumbnailGallery();
            } else {
                alert('Image upload failed');
            }
        } catch (err) {
            console.error(err);
            alert('Error uploaded image');
        }
    };
    reader.readAsDataURL(file);
    // Reset input so looking for the same file again triggers 'change'
    e.target.value = '';
});

// ── Thumbnail Picker Logic ──
let thumbUpdateTimeout = null;

function initThumbnailPicker() {
    const uploadBtn = document.getElementById('uploadThumbBtn');
    const fileInput = document.getElementById('thumbFileInput');
    const removeBtn = document.getElementById('removeThumbBtn');
    const editor = document.getElementById('editor');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function (event) {
                const base64String = event.target.result;
                try {
                    uploadBtn.disabled = true;
                    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i>Uploading...';
                    const response = await fetch('/upload-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: file.name,
                            image: base64String
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        document.getElementById('selectedThumbnail').value = data.url;
                        updateThumbnailGallery();
                    } else {
                        alert('Cover image upload failed');
                    }
                } catch (err) {
                    console.error(err);
                    alert('Error uploading cover image');
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.innerHTML = '<i class="fas fa-upload" style="margin-right: 6px;"></i>Upload Custom Thumbnail';
                    fileInput.value = '';
                }
            };
            reader.readAsDataURL(file);
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            document.getElementById('selectedThumbnail').value = '';
            updateThumbnailGallery();
        });
    }

    if (editor) {
        editor.addEventListener('input', () => {
            clearTimeout(thumbUpdateTimeout);
            thumbUpdateTimeout = setTimeout(updateThumbnailGallery, 500);
        });
    }
}

function updateThumbnailGallery() {
    const editor = document.getElementById('editor');
    const grid = document.getElementById('thumbnail-grid');
    const hiddenInput = document.getElementById('selectedThumbnail');
    const removeBtn = document.getElementById('removeThumbBtn');

    if (!grid || !hiddenInput) return;

    // Collect all unique images from editor content
    const imgElements = editor ? Array.from(editor.querySelectorAll('img')) : [];
    const images = [];

    // Add custom/selected thumbnail if already set
    if (hiddenInput.value && !images.includes(hiddenInput.value)) {
        images.push(hiddenInput.value);
    }

    imgElements.forEach(img => {
        let src = img.getAttribute('src');
        if (src) {
            // Clean relative path if needed
            if (src.startsWith('http://localhost:8000/')) {
                src = src.replace('http://localhost:8000/', '');
            } else if (src.startsWith('http://127.0.0.1:8000/')) {
                src = src.replace('http://127.0.0.1:8000/', '');
            }
            if (!images.includes(src)) {
                images.push(src);
            }
        }
    });

    // If nothing currently selected but we have images in content, auto-select first
    if (!hiddenInput.value && images.length > 0) {
        hiddenInput.value = images[0];
    }

    if (images.length === 0) {
        grid.innerHTML = '<p class="thumb-empty-msg">No images found in content yet. Upload images in the content editor or upload a custom thumbnail below.</p>';
        if (removeBtn) removeBtn.style.display = 'none';
        return;
    }

    if (removeBtn) {
        removeBtn.style.display = hiddenInput.value ? 'inline-flex' : 'none';
    }

    grid.innerHTML = images.map(src => {
        const isSelected = hiddenInput.value === src;
        return `
            <div class="thumb-option ${isSelected ? 'selected' : ''}" data-src="${src}" title="Click to set as thumbnail">
                <img src="${src}" alt="Thumbnail option" loading="lazy">
                <div class="thumb-badge"><i class="fas fa-check"></i></div>
            </div>
        `;
    }).join('');

    // Attach click events
    grid.querySelectorAll('.thumb-option').forEach(el => {
        el.addEventListener('click', () => {
            const src = el.getAttribute('data-src');
            hiddenInput.value = src;
            grid.querySelectorAll('.thumb-option').forEach(opt => opt.classList.remove('selected'));
            el.classList.add('selected');
            if (removeBtn) removeBtn.style.display = 'inline-flex';
        });
    });
}

