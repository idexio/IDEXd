FROM node:10-alpine

WORKDIR /usr/idexd/

COPY package*.json ./
RUN apk --no-cache --virtual build-dependencies add python git make g++ && \
    npm install -g pm2 && \
    npm install -g sequelize && \
    npm install && \
    apk del build-dependencies && \
    rm -rf /root && \
    apk --no-cache add curl

ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz && \
    tar -C /usr/local/bin -xzvf dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz && \
    rm dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz

COPY . .
RUN mkdir lib && \
    npm run build

EXPOSE 8080

ENTRYPOINT [ "pm2" ]
