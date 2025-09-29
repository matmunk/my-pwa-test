const DB_NAME = 'my-pwa-test-db'
const DB_VERSION = 1
const QUEUE_STORE = 'queue'
const CREDENTIALS_STORE = 'credentials'

export function initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result

            if (!db.objectStoreNames.contains(QUEUE_STORE)) {
                const queueStore = db.createObjectStore(QUEUE_STORE, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                })
                queueStore.createIndex('type', 'type', { unique: false })
            }

            if (!db.objectStoreNames.contains(CREDENTIALS_STORE)) {
                db.createObjectStore(CREDENTIALS_STORE, { keyPath: 'id' })
            }
        }
    })
}
