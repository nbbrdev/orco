import "server-only";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Arquivos do app no RustFS, pela API S3 (ADR-0015, NBB-81). Só o servidor fala com o RustFS: ele não
// tem porta pública, e as chaves de acesso ficam só no .env. Trocar de provedor S3 é só configuração.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Defina ${name} (veja .env.example).`);
  }
  return value;
}

type Storage = { client: S3Client; bucket: string };

const globalForStorage = globalThis as unknown as {
  orcoStorage?: Storage;
  orcoBucketReady?: Promise<void>;
};

/** Criado na primeira chamada, como o getAppDb(): o build não tem o .env. */
function getStorage(): Storage {
  globalForStorage.orcoStorage ??= {
    client: new S3Client({
      endpoint: requireEnv("S3_ENDPOINT"),
      // O RustFS ignora a região, mas o SDK exige uma.
      region: "us-east-1",
      // Endereço no formato http://rustfs:9000/bucket/chave (o RustFS não usa subdomínio por bucket).
      forcePathStyle: true,
      credentials: {
        accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
      },
    }),
    bucket: requireEnv("S3_BUCKET"),
  };
  return globalForStorage.orcoStorage;
}

/**
 * L1: o bucket nasce na primeira vez que o app precisa dele, em qualquer ambiente (local, CI, VPS),
 * sem passo manual. A checagem acontece uma vez por processo.
 */
async function ensureBucket({ client, bucket }: Storage): Promise<void> {
  globalForStorage.orcoBucketReady ??= (async () => {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  })().catch((error: unknown) => {
    // Se falhar, tenta de novo na próxima chamada.
    globalForStorage.orcoBucketReady = undefined;
    throw error;
  });
  return globalForStorage.orcoBucketReady;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const storage = getStorage();
  await ensureBucket(storage);
  await storage.client.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** O conteúdo do objeto, ou `null` se ele não existe. */
export async function getObject(key: string): Promise<Uint8Array | null> {
  const storage = getStorage();
  try {
    const result = await storage.client.send(
      new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
    );
    return result.Body ? await result.Body.transformToByteArray() : null;
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return null;
    }
    throw error;
  }
}

/** Apaga o objeto. Não reclama se ele já não existe. */
export async function deleteObject(key: string): Promise<void> {
  const storage = getStorage();
  await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
}
