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

export async function estimateAvailableStorage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage ?? 0;
        const quota = estimate.quota ?? 0;

        const usageMB = parseFloat((usage / (1024 * 1024)).toFixed(2));
        const quotaMB = parseFloat((quota / (1024 * 1024)).toFixed(2));
        const availableMB = parseFloat(((quota - usage) / (1024 * 1024)).toFixed(2));

        console.log(`Quota: ${quotaMB} MB | Used: ${usageMB} MB | Remaining: ${availableMB} MB`);
    } else {
        console.log("StorageManager API not supported");
    }
}
