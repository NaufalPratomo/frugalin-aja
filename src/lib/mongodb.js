import mongoose from "mongoose";
import dns from "node:dns";

// Pastikan resolusi DNS untuk MongoDB Atlas SRV menggunakan DNS publik (Google/Cloudflare)
// dan mendahulukan IPv4 untuk mencegah timeout DNS router lokal (fe80::1)
if (typeof dns !== "undefined") {
  try {
    if (dns.setDefaultResultOrder) {
      dns.setDefaultResultOrder("ipv4first");
    }
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    // Abaikan jika lingkungan runtime tidak mengizinkan kustomisasi DNS
  }
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Silakan definisikan variabel MONGODB_URI di dalam file .env.local",
  );
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;

