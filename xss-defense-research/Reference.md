# Removing previous docker - if needed
docker stop $(docker ps -q)

# Build the Docker image
docker build -t xss-test-app .

# Run the Docker container
docker run -p 3000:3000 xss-test-app

# Access the application
Open http://localhost:3000 in your browser

# Go to the folder for testing scripts
cd research 

# For initial xss-testing
node xss-test.js

# CSP testing
ENABLE_CSP=true node server.js
node csp-bypass-test.js

# DOMpurify test
node dompurify-bypass-test.js

# Trusted Type
http://localhost:3000/trusted-types-test