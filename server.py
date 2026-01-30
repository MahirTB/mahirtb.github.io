import http.server
import socketserver
import json
import os

PORT = 8000
DATA_DIR = 'data'
IMAGES_DIR = 'images'

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/save-post':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Determine file based on type
            filename = 'blogs.json' if data.get('type') == 'blog' else 'projects.json'
            filepath = os.path.join(DATA_DIR, filename)
            
            # Read existing data
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    try:
                        existing_data = json.load(f)
                    except json.JSONDecodeError:
                        existing_data = []
            else:
                existing_data = []
            
            # Check if this is an update or new
            item_id = data.get('id')
            
            if item_id:
                # Update existing
                found = False
                for i, item in enumerate(existing_data):
                    if str(item.get('id')) == str(item_id):
                        # Update fields
                        existing_data[i]['title'] = data['title']
                        existing_data[i]['summary'] = data['summary']
                        existing_data[i]['content'] = data['content']
                        existing_data[i]['savedAt'] = data.get('savedAt')
                        found = True
                        break
            else:
                # Add new item
                # Generate ID safely
                if existing_data:
                    max_id = max([int(x.get('id', 0)) for x in existing_data])
                    new_id = max_id + 1
                else:
                    new_id = 1
                
                data['id'] = new_id
                
                import datetime
                if 'date' not in data:
                    data['date'] = datetime.datetime.now().strftime("%Y-%m-%d")
                
                existing_data.insert(0, data) # Newest first
            
            # Write back
            with open(filepath, 'w') as f:
                json.dump(existing_data, f, indent=2)
            
            self.send_response(200)
            self.end_headers()
            response = {"status": "success", "id": data['id']}
            self.wfile.write(json.dumps(response).encode('utf-8'))
        elif self.path == '/upload-image':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                image_data = data['image'] # Base64 string
                filename = data['filename']
                
                # Strip metadata header if present (e.g. "data:image/png;base64,")
                if ',' in image_data:
                    header, encoded = image_data.split(',', 1)
                else:
                    encoded = image_data
                
                import base64
                file_content = base64.b64decode(encoded)
                
                # Ensure unique filename
                save_path = os.path.join('images', filename)
                counter = 1
                while os.path.exists(save_path):
                    name, ext = os.path.splitext(filename)
                    save_path = os.path.join('images', f"{name}_{counter}{ext}")
                    counter += 1
                
                with open(save_path, 'wb') as f:
                    f.write(file_content)
                    
                self.send_response(200)
                self.end_headers()
                # Return the relative path to the client
                self.wfile.write(json.dumps({"url": save_path.replace('\\', '/')}).encode('utf-8'))
                
            except Exception as e:
                print(e)
                self.send_error(500, "Image upload failed")
        elif self.path == '/delete-post':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                item_type = data.get('type')
                item_id = data.get('id')
                
                # Handle both 'blog' (from editor) and 'blogs' (from loader)
                if item_type in ['blog', 'blogs']:
                    filename = 'blogs.json'
                else:
                    filename = 'projects.json'
                
                filepath = os.path.join(DATA_DIR, filename)
                
                if os.path.exists(filepath):
                    with open(filepath, 'r') as f:
                        existing_data = json.load(f)
                    
                    # Find the item to delete
                    item_to_delete = next((item for item in existing_data if str(item.get('id')) == str(item_id)), None)
                    
                    if item_to_delete:
                        # Extract image paths from content
                        import re
                        content = item_to_delete.get('content', '')
                        # Regex to find <img src="images/...">
                        # We look for src="images/filename" or src="http://.../images/filename"
                        # But our editor inserts "images/filename" (strictly speaking, the response returns relative path)
                        # We will look for anything containing 'images/'
                        
                        img_urls = re.findall(r'src="([^"]+)"', content)
                        
                        for url in img_urls:
                            # We only care about local images in images/ dir
                            if 'images/' in url:
                                # Extract filename from url
                                # URL might be "images/foo.png" or "http://localhost:8000/images/foo.png"
                                filename = url.split('images/')[-1]
                                image_path = os.path.join(IMAGES_DIR, filename)
                                
                                try:
                                    if os.path.exists(image_path):
                                        os.remove(image_path)
                                        print(f"Deleted image: {image_path}")
                                except Exception as e:
                                    print(f"Error deleting image {image_path}: {e}")

                        # Filter out the item
                        new_data = [item for item in existing_data if str(item.get('id')) != str(item_id)]
                        
                        with open(filepath, 'w') as f:
                            json.dump(new_data, f, indent=2)
                            
                        self.send_response(200)
                        self.end_headers()
                        self.wfile.write(b'{"status": "deleted"}')
                    else:
                        self.send_error(404, "Item not found")
                else:
                    self.send_error(404, "File not found")

            except Exception as e:
                print(e)
                self.send_error(500, "Delete failed")
        else:
            self.send_error(404, "Not Found")

print(f"Serving at http://localhost:{PORT}")
with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    httpd.serve_forever()
