# Build and run the MisarReach MCP server over stdio.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --ignore-scripts
COPY src ./src
RUN npx tsc

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
COPY skills ./skills

# stdio transport: the client owns the process lifecycle, so there is no port
# to expose and no HTTP healthcheck to run.
ENTRYPOINT ["node", "dist/index.js"]
