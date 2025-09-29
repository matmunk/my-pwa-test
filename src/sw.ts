/// <reference lib="webworker" />

import { initDB } from "./services/db"
import { deleteImage, uploadImage } from "./services/s3"

import type { QueuedRequestData } from "./services/s3"

declare const self: ServiceWorkerGlobalScope

const STORE_NAME = 'queue'

async function logToApp(message: string) {
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
        client.postMessage({
            type: 'SW_LOG',
            message
        })
    })
}

async function processQueue(): Promise<void> {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const requests = await new Promise<QueuedRequestData[]>((resolve, reject) => {
        const getAllQuery = store.getAll()
        getAllQuery.onsuccess = () => resolve(getAllQuery.result as QueuedRequestData[])
        getAllQuery.onerror = () => reject(getAllQuery.error)
    })

    await logToApp(`Processing ${requests.length} queued requests`)

    let processedCount = 0

    for (const request of requests) {
        await logToApp(`Processing request: ${JSON.stringify(request)}`)

        try {
            if (request.type === 'upload') {
                await uploadImage(request.key, request.fileData!, request.contentType!)
            } else if (request.type === 'delete') {
                await deleteImage(request.key)
            }

            const deleteTransaction = db.transaction([STORE_NAME], 'readwrite')
            const deleteStore = deleteTransaction.objectStore(STORE_NAME)

            await new Promise<void>((resolve, reject) => {
                const deleteOperation = deleteStore.delete(request.id!)
                deleteOperation.onsuccess = () => resolve()
                deleteOperation.onerror = () => reject(deleteOperation.error)
            })

            processedCount++
        } catch (error) {
            console.log('Failed to sync request:', error)
        }
    }

    const clients = await self.clients.matchAll()
    clients.forEach(client => {
        client.postMessage({
            type: 'QUEUE_PROCESSED',
            processedCount
        })
    })
}

self.addEventListener('install', (event: ExtendableEvent) => {
    logToApp('Service Worker: Install')
    event.waitUntil(initDB())
})

self.addEventListener('activate', () => {
    logToApp('Service Worker: Activate')
})

self.addEventListener('message', (event: ExtendableMessageEvent) => {
    if (event.data && event.data.type === 'SYNC_QUEUE') {
        processQueue()
    }
})
