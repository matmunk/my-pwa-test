
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3"
import { S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { initDB } from "./db.ts"

const AWS_REGION = "eu-central-1"
const AWS_ACCESS_KEY_ID = "AKIAUD7OUZJXSTKRFDXM"
const AWS_SECRET_ACCESS_KEY = "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"
const STORE_NAME = 'queuedRequests'
const BUCKET = "my-pwa-test-upload"

export interface Image {
    url: string
    key: string
}

export interface QueuedRequestData {
    id?: number
    type: 'upload' | 'delete'
    key: string
    fileData?: ArrayBuffer
    contentType?: string
}

export const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
})

export async function listImages(): Promise<Image[]> {
    const res = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET }))

    if (!res.Contents) {
        return []
    }

    const images = await Promise.all(
        res.Contents
            .filter(obj => obj.Key)
            .map(async obj => {
                const command = new GetObjectCommand({
                    Bucket: BUCKET,
                    Key: obj.Key!
                })

                const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
                
                return {url, key: obj.Key!}
            })
    )

    return images
}

export async function queueUpload(key: string, fileData: ArrayBuffer, contentType: string) {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const request: QueuedRequestData = {
        type: 'upload',
        key,
        fileData,
        contentType
    }

    await store.add(request)
}

export async function queueDelete(key: string) {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const request: QueuedRequestData = {
        type: 'delete',
        key
    }

    await store.add(request)
}

export async function uploadImage(key: string, fileData: ArrayBuffer, contentType: string) {
    return s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: new Uint8Array(fileData),
        ContentType: contentType
    }))
}

export async function deleteImage(key: string) {
    return s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function uploadAndQueue(key: string, fileData: ArrayBuffer, contentType: string) {
    try {
        return await uploadImage(key, fileData, contentType)
    } catch (error) {
        if (!navigator.onLine) {
            await queueUpload(key, fileData, contentType)
            console.log('Queued for offline upload')
        } else {
            throw error
        }
    }
}

export async function deleteAndQueue(key: string) {
    try {
        return await deleteImage(key)
    } catch (error) {
        if (!navigator.onLine) {
            await queueDelete(key)
            console.log('Queued for offline deletion')
        } else {
            throw error
        }
    }
}
