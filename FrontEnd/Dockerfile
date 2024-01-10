FROM node:20-alpine
WORKDIR /fronend
COPY package*.json .
RUN npm install
COPY . .
ARG sls_url
ENV REACT_APP_SERVERLESS_URL=$sls_url

# FROM nginx:1.21.6-alpine
# COPY --from=build /app/build /usr/share/nginx/html
# RUN rm /etc/nginx/conf.d/default.conf
# COPY ./default.conf /etc/nginx/conf.d/

EXPOSE 3000
