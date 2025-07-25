import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
} from "../../redux/slices/messageSlice";
import Loader from "../../components/Loader";
import {
  FaArrowLeft,
  FaPaperPlane,
  FaMicrophone,
  FaMicrophoneSlash,
  FaGlobe,
} from "react-icons/fa";
import axios from "../../utils/axiosConfig";

const ConversationPage = () => {
  const { userId } = useParams();
  const dispatch = useDispatch();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [newMessage, setNewMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [translations, setTranslations] = useState({});

  const { messages, loading } = useSelector((state) => state.messages);
  const { user } = useSelector((state) => state.auth);

  const conversationMessages = messages[userId] || [];

  useEffect(() => {
    // Initial load of messages
    dispatch(getConversationMessages(userId))
      .unwrap()
      .then(() => {
        setInitialLoadComplete(true);
      });
    dispatch(markMessagesAsRead(userId));
  }, [dispatch, userId]);

  // Scroll to bottom only on initial load
  useEffect(() => {
    if (initialLoadComplete && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [initialLoadComplete]);

  // Auto-scroll functionality removed to prevent scrolling during polling
  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [conversationMessages]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false);
    recognition.onerror = (error) => {
      console.error('Speech recognition error:', error);
      setIsListening(false);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNewMessage((prev) => `${prev} ${transcript}`);
    };

    recognitionRef.current = recognition;
  }, []);
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;

    dispatch(sendMessage({ receiver: userId, content: newMessage }))
      .unwrap()
      .then(() => {
        // Scroll to bottom when user sends a new message
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
    setNewMessage("");
  };

  const handleVoiceInput = () => {
    if (recognitionRef.current) {
      isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleTranslate = async (messageId, text) => {
    if (translations[messageId]) {
      setTranslations((prev) => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          showOriginal: !prev[messageId].showOriginal,
        },
      }));
      return;
    }

    try {
      const res = await axios.post("/api/translate", { text });
      setTranslations((prev) => ({
        ...prev,
        [messageId]: {
          translated: res.data.translated,
          showOriginal: false,
        },
      }));
    } catch (error) {
      console.error('Translation error:', error);
      setTranslations((prev) => ({
        ...prev,
        [messageId]: {
          translated: "⚠️ Translation failed",
          showOriginal: false,
        },
      }));
    }
  };

  if (loading && conversationMessages.length === 0) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        to="/messages"
        className="flex items-center text-green-500 hover:text-green-700 mb-6"
      >
        <FaArrowLeft className="mr-2" />
        Back to Messages
      </Link>

      <div className="glass rounded-xl overflow-hidden">
        <div className="bg-green-500 text-white p-4">
          <h2 className="text-xl font-semibold">
            {conversationMessages.length > 0
              ? conversationMessages[0].sender._id === user._id
                ? conversationMessages[0].receiver.name
                : conversationMessages[0].sender.name
              : "Conversation"}
          </h2>
        </div>

        <div className="p-4 h-[60vh] overflow-y-auto bg-gray-50" ref={messagesContainerRef}>
          {conversationMessages.length > 0 ? (
            <div className="space-y-4">
              {conversationMessages.map((message) => {
                const isMe = message.sender._id === user._id;
                const t = translations[message._id];

                return (
                  <div
                    key={message._id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 relative ${isMe
                        ? "bg-green-500 text-white rounded-tr-none"
                        : "bg-white border border-gray-200 rounded-tl-none"
                        }`}
                    >
                      <p className="mb-1">
                        {t ? (t.showOriginal ? message.content : t.translated) : message.content}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <span
                          className={`text-xs ${isMe ? "text-green-100" : "text-gray-500"
                            }`}
                        >
                          {formatTime(message.createdAt)}
                        </span>
                        {!isMe && (<button
                          onClick={() => handleTranslate(message._id, message.content)}
                          className="ml-2 text-xs text-blue-500 hover:underline flex items-center gap-1"
                        >
                          <FaGlobe />
                          {t ? (t.showOriginal ? "हिंदी में देखें" : "Show Original") : "Translate"}
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-6 border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="form-input flex-grow"
              placeholder="   Type your message ...farmer"
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${isListening
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "bg-gray-100 text-gray-500 hover:bg-green-100"
                }`}
              title={isListening ? "Stop Listening" : "Start Voice Input"}
            >
              {isListening ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </button>
            <button
              type="submit"
              className="bg-green-500 text-white w-10 h-12 flex items-center justify-center rounded-lg hover:bg-green-600 transition-colors"
              disabled={newMessage.trim() === ""}
            >
              <FaPaperPlane />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ConversationPage;

