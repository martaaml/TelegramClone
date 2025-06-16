document.addEventListener("DOMContentLoaded", () => {
    const stored = localStorage.getItem("userData");

    /* Si no hay datos de usuario, redirigir al login */
    if (!stored) {
        alert("Datos de usuario faltantes. Redirigiendo al login...");
        window.location.href = "/";
        return;
    }

    /*Elementos y variables principales*/
    //Las variables se cogen y se asignan a través del ID
    const user = JSON.parse(stored);

    const socket = io();

    const chatList = document.getElementById("chatList");
    const chatTitle = document.getElementById("chatTitle");
    const chatMessages = document.getElementById("chatMessages");
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("messageInput");
    const chatHeaderAvatar = document.getElementById("chatHeaderAvatar");

    const chats = {
        general: []
    };

    let activeChat = "general";

    const avatars = {
        general: "https://cdn-icons-png.flaticon.com/512/1946/1946429.png"
    };


    /*Esta funcion es la encargada de mostrar los mensajes en el chat activo*/
    //ChatID es el ID del chat que se quiere mostrar, ya que cada chat tiene un ID único
    function renderMessages(chatId) {
        chatMessages.innerHTML = "";
        if (!chats[chatId]) chats[chatId] = [];
        chats[chatId].forEach(({ from, text, isOwn, special }) => {
            const msgDiv = document.createElement("div");

            //Muestra un mensaje "especial", cuando alguien esta escribiendo, o cuando alguien se une o sale del chat
            if (special) {
                msgDiv.textContent = text;
                msgDiv.style.fontStyle = "italic";
                msgDiv.style.textAlign = "center";
                msgDiv.style.color = "#666";
            } else {
                msgDiv.textContent = text;
                msgDiv.className = isOwn ? "own" : "other";

                const nameSpan = document.createElement("strong");
                nameSpan.textContent = isOwn ? "Tú: " : `${from}: `;
                msgDiv.prepend(nameSpan);
            }

            chatMessages.appendChild(msgDiv);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }


    //Función para establecer el chat activo
    function setActiveChat(chatId, displayName) {
        activeChat = chatId;

        chatTitle.textContent = displayName;
        chatHeaderAvatar.src = avatars[chatId] || "https://cdn-icons-png.flaticon.com/512/1946/1946429.png";
        chatHeaderAvatar.alt = displayName;
        // Se convierte a un array los elementos hijos de 'chatList' para poder iterar sobre ellos.
        [...chatList.children].forEach(li => {
            // Se verifica si el valor del atributo 'data-chat' de cada 'li' es igual al 'chatId' actual.
            // Si es igual, se agrega la clase 'active', si no, se elimina.
            li.classList.toggle("active", li.dataset.chat === chatId);
        });


        renderMessages(chatId);
    }


    //Función para añadir un chat privado al sidebar, es decir, cuando alguien se une al chat te muestra un chat privado con esa persona
    function addPrivateChat(userObj) {
        if (document.querySelector(`[data-chat="${userObj.name}"]`)) return;

        const li = document.createElement("li");
        li.dataset.chat = userObj.name;
        li.style.cursor = "pointer";

        li.innerHTML = `
      <img src="${userObj.avatar}" alt="${userObj.name}" width="30" height="30" style="border-radius:50%; margin-right:8px;">
      <span>${userObj.name}</span>
    `;

        avatars[userObj.name] = userObj.avatar;

        li.addEventListener("click", () => {
            setActiveChat(userObj.name, userObj.name);
        });

        chatList.appendChild(li);

        if (!chats[userObj.name]) chats[userObj.name] = [];
    }

    const generalChatLi = document.querySelector('li[data-chat="general"]');
    generalChatLi.addEventListener("click", () => {
        setActiveChat("general", "Chat General");
    });

    socket.emit("join", user);

    socket.on("user-list", users => {
        [...chatList.children].forEach(li => {
            if (li.dataset.chat !== "general") li.remove();
        });

        users.forEach(u => {
            if (u.name !== user.name) addPrivateChat(u);
        });
    });

    socket.on("message", ({ user: fromUser, text }) => {
        chats.general.push({ from: fromUser.name, text, isOwn: fromUser.name === user.name });
        if (activeChat === "general") renderMessages("general");
    });

    socket.on("private-message", ({ from, text }) => {
        if (!chats[from]) chats[from] = [];
        chats[from].push({ from, text, isOwn: false });

        if (activeChat === from) {
            renderMessages(from);
        } else {
            alert(`Nuevo mensaje privado de ${from}`);
        }
    });

    socket.on("user-joined", (msg) => {
        chats.general.push({ from: "Sistema", text: msg, isOwn: false, special: true });
        if (activeChat === "general") renderMessages("general");
    });

    socket.on("user-left", (msg) => {
        chats.general.push({ from: "Sistema", text: msg, isOwn: false, special: true });
        if (activeChat === "general") renderMessages("general");
    });

    socket.on("typing", ({ user: userName, typing }) => {
        const typingDivId = "typingStatus";
        let typingDiv = document.getElementById(typingDivId);

        if (!typingDiv) {
            typingDiv = document.createElement("div");
            typingDiv.id = typingDivId;
            typingDiv.style.fontStyle = "italic";
            typingDiv.style.marginTop = "5px";
            chatMessages.parentNode.appendChild(typingDiv);
        }

        if (typing && userName !== user.name) {
            typingDiv.textContent = `${userName} está escribiendo...`;
        } else {
            typingDiv.textContent = "";
        }
    });

    chatForm.addEventListener("submit", e => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text) return;

        if (activeChat === "general") {
            socket.emit("message", text);
        } else {
            socket.emit("private-message", { to: activeChat, text });
            if (!chats[activeChat]) chats[activeChat] = [];
            chats[activeChat].push({ from: user.name, text, isOwn: true });
            renderMessages(activeChat);
        }

        messageInput.value = "";
    });

    setActiveChat("general", "Chat General");
});
