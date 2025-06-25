# ---------- 1️⃣ build stage ----------
FROM node:18 AS build
WORKDIR /app

# copy package manifests first (better cache)
COPY package*.json ./
RUN npm ci          # reproducible install

# copy the rest and build
COPY . .
RUN npm run build   # creates static files in /app/build

# ---------- 2️⃣ run stage ----------
FROM node:18-slim
RUN npm i -g serve          # tiny static-file server
WORKDIR /app
COPY --from=build /app/build ./build

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
