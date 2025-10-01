import "@fontsource/roboto/300.css"
import "@fontsource/roboto/400.css"
import "@fontsource/roboto/500.css"
import "@fontsource/roboto/700.css"
import "./App.css"
import { useEffect, useState } from "react"
import CloudUploadIcon from "@mui/icons-material/CloudUpload"
import CodeIcon from "@mui/icons-material/Code"
import DeleteIcon from "@mui/icons-material/Delete"
import LockOutlineIcon from "@mui/icons-material/LockOutline"
import WifiIcon from "@mui/icons-material/Wifi"
import WifiOffIcon from "@mui/icons-material/WifiOff"
import { AppBar, Box, Button, Chip, Container, Drawer, IconButton, ImageList, ImageListItem, Toolbar } from "@mui/material"
import { styled } from "@mui/material/styles"
import CredentialsDialog from "./credentials"
import { estimateAvailableStorage } from "./services/db"
import { deleteAndQueue, listImages, uploadAndQueue } from "./services/s3"

import type { Image } from "./services/s3"

type ConsoleEntry = {
    type: "log" | "warn" | "error" | "info"
    message: string
}

const VisuallyHiddenInput = styled("input")({
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    bottom: 0,
    left: 0,
    whiteSpace: "nowrap",
    width: 1
})

function App() {
    const [logs, setLogs] = useState<ConsoleEntry[]>([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [images, setImages] = useState<Image[]>([])
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const toggleDrawer = () => setDrawerOpen(!drawerOpen)

    useEffect(() => {
        const formatArg = (a: unknown): string => (typeof a === "object" ? JSON.stringify(a) : String(a))

        const pushLog = (type: ConsoleEntry["type"], args: unknown[]) => {
            setLogs(prev => [...prev, { type, message: args.map(formatArg).join(" ") }])
        }

        const original = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        }

        console.log = (...args: unknown[]) => {
            original.log(...args)
            pushLog("log", args)
        }

        console.warn = (...args: unknown[]) => {
            original.warn(...args)
            pushLog("warn", args)
        }

        console.error = (...args: unknown[]) => {
            original.error(...args)
            pushLog("error", args)
        }

        console.info = (...args: unknown[]) => {
            original.info(...args)
            pushLog("info", args)
        }

        return () => {
            console.log = original.log
            console.warn = original.warn
            console.error = original.error
            console.info = original.info
        }
    }, [])

    useEffect(() => {
        fetchImages()
    }, [])

    useEffect(() => {
        if ("serviceWorker" in navigator) {
            console.log("Service Worker supported")
        } else {
            console.log("Service Worker not supported - offline queue functionality disabled")
        }

        if ("indexedDB" in window) {
            console.log("IndexedDB supported")
        } else {
            console.log("IndexedDB not supported - offline storage disabled")
        }
    }, [])

    useEffect(() => {
        estimateAvailableStorage()

        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: "SYNC_QUEUE" })
        }

        const handleOnline = () => {
            setIsOnline(true)

            if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: "SYNC_QUEUE" })
            }
        }
        const handleOffline = () => setIsOnline(false)

        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === "QUEUE_PROCESSED") {
                if (event.data.processedCount > 0) {
                    fetchImages()
                }
            }

            if (event.data && event.data.type === "SW_LOG") {
                console.log(event.data.message)
            }
        }

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("message", handleMessage)
        }

        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)

            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.removeEventListener("message", handleMessage)
            }
        }
    }, [])

    async function fetchImages() {
        const imageList = await listImages()
        setImages(imageList)
    }

    async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const files = event.target.files

        if (!files) {
            return
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            await uploadAndQueue(file.name, await file.arrayBuffer(), file.type)
        }

        fetchImages()
    }

    async function handleDeleteImage(key: string) {
        await deleteAndQueue(key)
        fetchImages()
    }

    return (
        <>
            <CredentialsDialog open={dialogOpen} onClose={() => {fetchImages(); setDialogOpen(false)}} />
            <Box sx={{ flexGrow: 1 }}>
                <AppBar color="inherit">
                    <Toolbar>
                        <Button color="inherit" component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
                            Upload
                            <VisuallyHiddenInput type="file" onChange={event => handleFileChange(event)} multiple />
                        </Button>
                        <Box sx={{ ml: "auto" }}>
                            <IconButton color="inherit" sx={{ mr: 1 }} onClick={() => setDialogOpen(true)}>
                                <LockOutlineIcon />
                            </IconButton>
                            <IconButton color="inherit" sx={{ mr: 2 }} onClick={toggleDrawer}>
                                <CodeIcon />
                            </IconButton>
                            <Chip
                                icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
                                label={isOnline ? "Online" : "Offline"}
                                color={isOnline ? "success" : "error"}
                                variant="outlined"
                            />
                        </Box>
                    </Toolbar>
                </AppBar>
            </Box>
            <Toolbar />
            <Container>
                <ImageList variant="masonry" cols={2} gap={4}>
                    {images.map(image => (
                        <ImageListItem key={image.key}>
                            <img src={image.url} />
                            <IconButton
                                sx={{
                                    position: "absolute",
                                    top: 4,
                                    right: 4,
                                    bgcolor: "rgba(0,0,0,0.6)",
                                    color: "white",
                                    "&:hover": {
                                        bgcolor: "rgba(0,0,0,0.8)"
                                    }
                                }}
                                size="small"
                                onClick={() => handleDeleteImage(image.key)}
                            >
                                <DeleteIcon fontSize="inherit" />
                            </IconButton>
                        </ImageListItem>
                    ))}
                </ImageList>
            </Container>
            <Drawer keepMounted={true} anchor="bottom" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <Box sx={{ px: 2, pb: 2, maxHeight: 500, overflow: "auto" }}>
                    {logs.map((log, i) => (
                        <p style={{ fontFamily: "monospace" }} key={i}>
                            [{log.type}] {log.message}
                        </p>
                    ))}
                </Box>
            </Drawer>
        </>
    )
}

export default App

