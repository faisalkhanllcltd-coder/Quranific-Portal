import requests
print([requests.post('http://127.0.0.1:8000/api/accounts/login/', json={'username':'a','password':'a'}).status_code for _ in range(10)])
