FROM node:22-alpine

WORKDIR /app
COPY src ./src
EXPOSE 3000
CMD ["node", "--experimental-strip-types", "src/index.ts"]
