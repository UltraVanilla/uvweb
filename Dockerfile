FROM node:18

WORKDIR /app

ADD --chown=node:node uvdynmap-1.0.0.tgz /app

RUN chown -R node:node /app

USER node

WORKDIR /app/package
ENV NODE_ENV production

RUN npm install --ignore-scripts && npm cache clean --force

ARG PORT=8080
ENV PORT $PORT
EXPOSE $PORT 8080

CMD [ "node", "lib/server.js" ]
