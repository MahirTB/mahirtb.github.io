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
});

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

    const payload = {
        type,
        title,
        summary,
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
