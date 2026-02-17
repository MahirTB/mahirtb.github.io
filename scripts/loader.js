/**
 * generic content loader
 * Usage: loadContent('blogs') or loadContent('projects')
 */
async function loadContent(type) {
    const container = document.getElementById('content-list');
    const detailContainer = document.getElementById('content-detail');

    // Check if we are in detail view (URL param ?id=X)
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    // Admin Check
    const isAdmin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    try {
        // Append timestamp to prevent caching
        const response = await fetch(`data/${type}.json?t=${new Date().getTime()}`);
        const data = await response.json();

        if (id && detailContainer) {
            // Show Detail
            const item = data.find(i => String(i.id) === id);
            if (item) {
                document.getElementById('detail-title').innerText = item.title;
                document.getElementById('detail-date').innerText = item.date || '';
                document.getElementById('detail-body').innerHTML = item.content;

                // Add Delete Button dynamically (ADMIN ONLY)
                let existingBtn = document.getElementById('delete-btn');
                if (existingBtn) existingBtn.remove();

                if (isAdmin) {
                    const btnContainer = document.createElement('div');
                    btnContainer.style.marginTop = '20px';
                    btnContainer.style.textAlign = 'right';

                    // Edit Button
                    const editBtn = document.createElement('a');
                    // Remove 's' from type (blogs->blog) for editor
                    const editorType = type.endsWith('s') ? type.slice(0, -1) : type;
                    editBtn.href = `editor?type=${editorType}&id=${item.id}`;
                    editBtn.innerText = 'Edit Post';
                    editBtn.className = 'btn';
                    editBtn.style.marginRight = '10px';
                    editBtn.style.backgroundColor = '#6B8E6B'; // Match theme

                    // Delete Button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerText = 'Delete Post';
                    deleteBtn.id = 'delete-btn';
                    deleteBtn.className = 'btn';
                    deleteBtn.style.backgroundColor = '#e57373';
                    deleteBtn.style.color = 'white';

                    deleteBtn.onclick = async () => {
                        if (confirm('Are you sure?')) {
                            try {
                                const res = await fetch('/delete-post', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ type: type, id: item.id })
                                });
                                if (res.ok) {
                                    alert('Deleted!');
                                    window.location.href = type;
                                } else {
                                    alert('Failed to delete');
                                }
                            } catch (e) { console.error(e); alert('Error'); }
                        }
                    };

                    btnContainer.appendChild(editBtn);
                    btnContainer.appendChild(deleteBtn);
                    document.querySelector('article').appendChild(btnContainer);
                }

                container.style.display = 'none';
                detailContainer.style.display = 'block';
            } else {
                console.log('Item not found for id:', id);
                container.style.display = 'none'; // Hide Loading...
                detailContainer.innerHTML = '<p>Item not found.</p>';
                detailContainer.style.display = 'block';
            }
        } else if (container) {
            // Show List
            if (data.length === 0) {
                if (isAdmin) {
                    container.innerHTML = '<p>No content yet. Use the <a href="editor">Editor</a> to add some.</p>';
                } else {
                    container.innerHTML = '<p>No content yet.</p>';
                }
                return;
            }

            container.innerHTML = data.map(item => `
        <div class="card">
          <h3><a href="?id=${item.id}" style="text-decoration: none; color: inherit;">${item.title}</a></h3>
          <small>${item.date || ''}</small>
          <p>${item.summary || ''}</p>
          <a href="?id=${item.id}" class="btn" style="margin-top: 10px; font-size: 0.8em;">Read More</a>
        </div>
      `).join('');

            if (detailContainer) detailContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading data:', error);
        if (container) container.innerHTML = '<p>Error loading content.</p>';
    }
}
