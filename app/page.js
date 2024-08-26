'use client'
import { useState, useRef, useEffect } from "react";
import { Box, Stack, TextField, Button, Modal, Typography } from "@mui/material";
import LinkIcon from '@mui/icons-material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import ReactMarkdown from "react-markdown";


export default function Home() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm the Rate My Professor support assistant, how can I help you?" },
  ]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setLink('');
  };
  const [link, setLink] = useState('')

  const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
  };

  const sendMessage = async () => {
    if (!message.trim()) return; // prevent empty messages

    setLoading(true);
    setMessage('');
    setMessages((messages) => [
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([...messages, { role: 'user', content: message }]),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      await reader.read().then(function processText({ done, value }) {
        if (done) return result;
        const text = decoder.decode(value || new Uint8Array(), { stream: true });
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1];
          let otherMessages = messages.slice(0, messages.length - 1);
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text },
          ];
        });
        return reader.read().then(processText);
      });
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendLink = async () => {
    handleClose();
    if (!link) {
      alert('Please enter a link');
      return;
    }

    try {
      const response = await fetch('/api/professors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: link }), // TODO: enforce rate my professor url format
      });
      const result = await response.json();
      console.log(result);

      // Add a message indicating that memory has been updated
      setMessages((messages) => [
        ...messages,
        { role: 'assistant', content: 'Memory updated' },
    ]);
    } catch (error) {
      console.error("Error sending link:", error);
    }
    setLink('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Stack
        direction="column"
        width="500px"
        height="700px"
        border="1px solid black"
        p={2}
        spacing={3}
      >
        <Stack direction="column" spacing={2} flexGrow={1} overflow="auto" maxHeight="100%">
          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={message.role === 'assistant' ? 'flex-start' : 'flex-end'}
            >
              <Box
                bgcolor={message.role === 'assistant' ? 'primary.main' : 'secondary.light'}
                color="white"
                borderRadius={16}
                p={3}
              >
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
          />
          <Button variant="contained" onClick={sendMessage} disabled={loading}>
            {loading ? 'Sending...' : 'Send'}
          </Button>

          <Button variant="contained" onClick={handleOpen} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : <LinkIcon />}
          </Button>
        </Stack>
      </Stack>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Insert the Professor&apos;s Link
          </Typography>
          <TextField 
            label= "Link"
            fullWidth
            value={link}
            onChange={(e) => setLink(e.target.value)}
            sx={{
              mb: 1,
            }}
          />
          <Button variant="contained" onClick={sendLink}>Enter</Button>
        </Box>
      </Modal>
    </Box>
  );
}

