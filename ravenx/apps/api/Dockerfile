FROM node:20-alpine
WORKDIR /app
COPY apps/api/package.json apps/api/package.json
RUN npm install --prefix apps/api
COPY apps/api apps/api
EXPOSE 8787
ENV PORT=8787
CMD ["node","apps/api/src/index.mjs"]
