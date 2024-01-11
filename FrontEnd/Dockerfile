FROM node:16.10-alpine
WORKDIR /fronend
COPY package.json .
COPY package-lock.json .
RUN npm install
COPY . .
ARG sls_url
ENV REACT_APP_SERVERLESS_URL=$sls_url
RUN npm run build
EXPOSE 3000
