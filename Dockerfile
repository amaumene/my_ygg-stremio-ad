FROM alpine AS builder

RUN apk add --no-cache nodejs npm python3 py3-setuptools make gcc g++ musl-dev sqlite-static sqlite-dev

WORKDIR /build

RUN npm set prefix=/build

COPY package*.json ./

COPY . .

RUN npm install --omit dev --build-from-source --sqlite=/usr/lib

FROM alpine

RUN apk add --no-cache nodejs

WORKDIR /app

COPY --from=builder /build /app

EXPOSE 5000

CMD ["node", "index.js"]
