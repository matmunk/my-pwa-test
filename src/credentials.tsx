import { useState } from "react"
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material"
import { saveCredentials } from "./services/s3"

import type { AWSCredentials } from "./services/s3"

interface CredentialsDialogProps {
    open: boolean
    onClose: () => void
}

export default function CredentialsDialog({ open, onClose }: CredentialsDialogProps) {
    const [credentials, setCredentials] = useState<AWSCredentials>({
        accessKeyId: "",
        secretAccessKey: ""
    })

    const handleSave = () => {
        saveCredentials(credentials)
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Indtast AWS Credentials</DialogTitle>
            <DialogContent>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                    <TextField
                        label="Access Key ID"
                        value={credentials.accessKeyId}
                        onChange={e => setCredentials(prev => ({ ...prev, accessKeyId: e.target.value }))}
                        fullWidth
                    />
                    <TextField
                        label="Secret Access Key"
                        type="password"
                        value={credentials.secretAccessKey}
                        onChange={e => setCredentials(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                        fullWidth
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
                <Button onClick={onClose}>Luk</Button>
                <Button
                    onClick={handleSave}
                    variant="outlined"
                    disabled={!credentials.accessKeyId || !credentials.secretAccessKey}
                >
                    Gem
                </Button>
            </DialogActions>
        </Dialog>
    )
}
