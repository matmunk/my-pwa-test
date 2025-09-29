
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3"
import { S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { initDB } from "./db.ts"

const AWS_REGION = "eu-central-1"
const CREDENTIALS_KEY = 'aws-credentials'
const STORE_NAME = 'queued-requests'
const BUCKET = "my-pwa-test-upload"

export interface AWSCredentials {
    accessKeyId: string
    secretAccessKey: string
}

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

export function saveCredentials(credentials: AWSCredentials): void {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
}

export function loadCredentials(): AWSCredentials | null {
    const stored = localStorage.getItem(CREDENTIALS_KEY)
    if (!stored) return null

    try {
        return JSON.parse(stored)
    } catch {
        return null
    }
}

export function getS3Client(): S3Client {
    const credentials = loadCredentials()
    if (!credentials) {
        throw new Error('AWS credentials not set')
    }

    return new S3Client({
        region: AWS_REGION,
        credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey
        }
    })
}

export async function listImages(): Promise<Image[]> {
    const res = await getS3Client().send(new ListObjectsV2Command({ Bucket: BUCKET }))

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

                const url = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 })
                
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
    return getS3Client().send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: new Uint8Array(fileData),
        ContentType: contentType
    }))
}

export async function deleteImage(key: string) {
    return getS3Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
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
