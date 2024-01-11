FROM node:16.10-alpine
WORKDIR /frontend
COPY package.json .
COPY package-lock.json .
RUN npm install
COPY . .
ARG SLS_URL
ENV REACT_APP_SERVERLESS_URL=$SLS_URL
RUN npm run build
EXPOSE 3000
