import urllib.request
import urllib.error

url = 'http://localhost:8000/projects.html'
print(f"Checking {url}...")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def http_error_301(self, req, fp, code, msg, headers):
        print(f"Received 301 Redirect to: {headers['Location']}")
        return None
    def http_error_302(self, req, fp, code, msg, headers):
        print(f"Received 302 Redirect to: {headers['Location']}")
        return None

try:
    opener = urllib.request.build_opener(NoRedirect)
    response = opener.open(url)
    print(f"Received code: {response.getcode()}")
except urllib.error.HTTPError as e:
    if e.code == 301:
         print(f"Success! Received 301 Redirect to: {e.headers['Location']}")
    else:
         print(f"Received HTTP Error: {e.code}")
except Exception as e:
    print(f"Error: {e}")
