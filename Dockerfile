FROM node:16-alpine
ENV NODE_ENV production

WORKDIR /app
COPY ["package.json", "yarn.lock", "./"]
RUN yarn install
COPY . .
RUN apk add --no-cache mongodb-tools
CMD ["yarn", "start"]