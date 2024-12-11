FROM node:22

WORKDIR /app

ADD --chown=node:node uvweb-1.0.0.tgz /app
COPY --chown=node:node package-lock.json /package-lock.json

RUN chown -R node:node /app

USER node

WORKDIR /app/package

RUN cp -v /package-lock.json ./package-lock.json
RUN npm install --ignore-scripts && npm cache clean --force
RUN cp -rv vendor/* assets/

ARG PORT=8080
ENV PORT $PORT
EXPOSE $PORT 8080
ENV NODE_ENV production

CMD [ "node", "lib/server.js" ]
