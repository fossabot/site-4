import { useRef, useState, useEffect } from "react";
import Blog from "../components/blog";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import { Lines } from "../components/loading";
import { v4 as uuidv4 } from "uuid";
import { fetchEventSource } from "@microsoft/fetch-event-source";

let parentMessageId = null;
let conversationId = null;

const md = new MarkdownIt({
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, {
        language: lang,
        ignoreIllegals: true,
      }).value;
    }
    return "";
  },
});

const Message = ({ role, content, isLoading }) => {
  if (role === "user") {
    return (
      <div
        className="p-2"
        dangerouslySetInnerHTML={{
          __html: md.render(`○ ${content}`),
        }}
      ></div>
    );
  }
  if (isLoading) {
    return <Lines />;
  }
  return (
    <div
      className="py-4 prose-p:p-2 prose-p:my-0 prose-pre:px-6 prose-pre:my-0 prose-pre:break-words"
      dangerouslySetInnerHTML={{
        __html: md.render(`● ${content}`),
      }}
    ></div>
  );
};

const Chat = props => {
  const { q } = props;
  const [chat, setChat] = useState([]);
  const inputRef = useRef();
  const bottomRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async function sendQ() {
      await send();
    })();
    bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const handleKeyDown = event => {
    if (event.keyCode === 13) {
      send();
    }
  };

  const send = async () => {
    const question = inputRef.current.value;
    if (question === "" || !question) {
      return;
    }
    chat.push({ role: "user", content: question });
    inputRef.current.value = "";
    await answer(question);
    inputRef.current.focus();
  };

  const answer = async question => {
    setChat([...chat]);
    setIsLoading(true);
    let currentData = "";
    try {
      const body = {
        messages: [
          {
            id: uuidv4(),
            author: {
              role: "user",
            },
            content: {
              parts: [question],
              content_type: "text",
            },
            create_time: (Date.now() / 1000).toFixed(7),
          },
        ],
        parent_message_id: parentMessageId ? parentMessageId : uuidv4(),
        model: "text-davinci-002-render-sha-mobile",
        action: "next",
      };
      if (conversationId) {
        body.conversation_id = conversationId;
      }
      chat.push({ role: "assistant", content: "" });
      await fetchEventSource(process.env.NEXT_PUBLIC_CHAT_API, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/event-stream",
          "oai-client-type": "ios",
        },
        body: JSON.stringify(body),
        onmessage(event) {
          if (event.data === "[DONE]") {
            return;
          }
          chat.pop();
          setChat([...chat]);
          const data = JSON.parse(event.data);
          console.debug("sse onmessage", event.data);
          currentData = data.message?.content?.parts?.[0];
          conversationId = data.conversation_id;
          parentMessageId = data.message.id;
          chat.push({
            role: "assistant",
            content: currentData + "●",
          });
          setChat([...chat]);
          bottomRef.current.scrollIntoView({ behavior: "smooth" });
        },
        onerror(error) {
          throw error;
        },
        async onclose() {
          console.debug("sse closed");
          chat.pop();
          setAssistantChat(currentData);
          const fly = await fetch(
            `${process.env.NEXT_PUBLIC_LOG_API}?message=${question}`
          );
          const res = await fly.json();
          console.debug(res);
        },
      });
    } catch (error) {
      setAssistantChat(error);
      return;
    }
  };

  const setAssistantChat = content => {
    setIsLoading(false);
    chat.push({ role: "assistant", content });
    setChat([...chat]);
  };

  const clear = () => {
    setChat([]);
  };

  const regenerate = async () => {
    chat.pop();
    await answer(chat.slice(-1)[0].content);
  };

  return (
    <Blog
      noMeta
      // noFooter
      title={`${q ? q : ""}`}
      description="Get instant answers, explanations, and examples for all of your questions."
    >
      {chat.map((messageObj, index) => {
        return (
          <Message
            content={messageObj.content}
            role={messageObj.role}
            key={index}
          />
        );
      })}
      {chat.length > 1 && !isLoading && (
        <div className="flex">
          <div className="flex-1"></div>
          <div className="p-1 h-6 w-6 mr-4 cursor-pointer" onClick={regenerate}>
            ↺
          </div>
        </div>
      )}
      {isLoading && <Message role={"assistant"} isLoading={true} />}
      <div ref={bottomRef} id="input" className="mt-20">
        <div className="flex">
          <input
            ref={inputRef}
            type="text"
            placeholder=""
            defaultValue={q}
            onKeyDown={handleKeyDown}
            className="h-12 pl-4 py-3 bg-zinc-100 flex-1 dark:bg-zinc-800 rounded-none outline-none"
          />
          <button
            className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 text-2xl"
            onClick={send}
          >
            ▲
          </button>
          {chat.length > 0 && (
            <button
              className="w-12 bg-zinc-100 dark:bg-zinc-800 text-2xl"
              onClick={clear}
            >
              ○
            </button>
          )}
        </div>
      </div>
    </Blog>
  );
};

export default Chat;

export async function getServerSideProps(context) {
  const { q } = context.query;
  if (q) {
    return {
      props: {
        q,
      },
    };
  }
  return {
    props: {},
  };
}
