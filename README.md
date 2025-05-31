You can run the tests by first starting the server and then running each test script. First, navigate to the parent folder using:

## Parent Folder
```cd xss-defense-research ```

## Removing previous docker - if needed
docker stop $(docker ps -q)

## Build the Docker image
docker build -t xss-test-app .

## Run the Docker container
docker run -p 3000:3000 xss-test-app

## The server should now be up and running,  Access the application by:
Open http://localhost:3000 in your browser

## Go to the folder for testing scripts
cd research 

## Then, run each test type the following two commands:
node xss-test.js

node DOMPurify-test.js



