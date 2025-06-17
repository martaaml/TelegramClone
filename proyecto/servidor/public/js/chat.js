document.addEventListener("DOMContentLoaded", () => {
    const stored = localStorage.getItem("userData");

    if (!stored) {
        alert("Datos de usuario faltantes. Redirigiendo al login...");
        window.location.href = "/";
        return;
    }

    const user = JSON.parse(stored);
    const socket = io();
    //vARIABLES DEL DOM
    const chatList = document.getElementById("chatList");
    const chatTitle = document.getElementById("chatTitle");
    const chatMessages = document.getElementById("chatMessages");
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("messageInput");
    const chatHeaderAvatar = document.getElementById("chatHeaderAvatar");

    const chats = { general: [] };
    let activeChat = "general";
    // Avatares por defecto
    const avatars = {
        general: "https://cdn-icons-png.flaticon.com/512/1946/1946429.png"
    };


    //Funcion para renderizar mensajes
    // Esta función recibe el ID del chat y renderiza los mensajes correspondientes
    function renderMessages(chatId) {
        chatMessages.innerHTML = "";
        if (!chats[chatId]) chats[chatId] = [];
        chats[chatId].forEach(({ from, text, isOwn, special }) => {
            const msgDiv = document.createElement("div");

            //Si es un mensaje especial, como un aviso de que alguien se unió o salió, lo estilizamos diferente
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

    // Esta función establece el chat activo y actualiza el título y avatar del encabezado
    // También resalta el chat activo en la lista de chats
    function setActiveChat(chatId, displayName) {
        activeChat = chatId;

        chatTitle.textContent = displayName;
        chatHeaderAvatar.src = avatars[chatId] || "https://cdn-icons-png.flaticon.com/512/1946/1946429.png";
        chatHeaderAvatar.alt = displayName;

        [...chatList.children].forEach(li => {
            li.classList.toggle("active", li.dataset.chat === chatId);
        });

        renderMessages(chatId);
    }

    // Esta función agrega un chat privado a la lista de chats
    function addPrivateChat(userObj) {
        //QuerySelector busca un elemento con el atributo data-chat que coincida con el nombre del usuario
        if (document.querySelector(`[data-chat="${userObj.name}"]`)) return;
        //Crea un nuevo elemento li para el chat privado
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
    // Agregar el chat general a la lista de chats
    const generalChatLi = document.querySelector('li[data-chat="general"]');
    generalChatLi.addEventListener("click", () => {
        setActiveChat("general", "Chat General");
    });
    //Aviso de que se ha unido al chat general
    socket.emit("join", user);

    //Recibir la lista de usuarios conectados
    socket.on("user-list", users => {
        //Eliminar los chats que ya no están conectados
        [...chatList.children].forEach(li => {
            if (li.dataset.chat !== "general") li.remove();
        });

        users.forEach(u => {
            if (u.name !== user.name) addPrivateChat(u);
        });
    });


    //Recibir mensajes del chat general 
    socket.on("message", ({ user: fromUser, text }) => {
        chats.general.push({ from: fromUser.name, text, isOwn: fromUser.name === user.name });
        if (activeChat === "general") renderMessages("general");
    });
    //Recibir mensajes privados
    // Esta función recibe mensajes privados y los agrega al chat correspondiente
    socket.on("private-message", ({ from, text }) => {
        if (!chats[from]) chats[from] = [];
        chats[from].push({ from, text, isOwn: false });

        if (activeChat === from) {
            renderMessages(from);
        } else {
            alert(`Nuevo mensaje privado de ${from}`);
        }
    });


    //Recibir avisos de que un usuario se ha unido o salió
    socket.on("user-joined", (msg) => {
        chats.general.push({ from: "Sistema", text: msg, isOwn: false, special: true });
        if (activeChat === "general") renderMessages("general");
    });

    socket.on("user-left", (msg) => {
        chats.general.push({ from: "Sistema", text: msg, isOwn: false, special: true });
        if (activeChat === "general") renderMessages("general");
    });
    //Recibir notificaciones de que un usuario está escribiendo
    // Esta función muestra un mensaje de "está escribiendo..." cuando un usuario escribe en el chat
    //Se mostrara encima del input de escritura
    socket.on("typing", ({ user: userName, typing, chatId }) => {
        const typingDivId = "typingStatus";
        let typingDiv = document.getElementById(typingDivId);

        if (!typingDiv) {
            typingDiv = document.createElement("div");
            typingDiv.id = typingDivId;
            typingDiv.style.fontStyle = "italic";
            typingDiv.style.marginBottom = "5px";
            typingDiv.style.textAlign = "left";

            // Insertar justo antes del formulario (input de escritura)
            chatForm.parentNode.insertBefore(typingDiv, chatForm);
        }


        if (typing && userName !== user.name && chatId === activeChat) {
            typingDiv.textContent = `${userName} está escribiendo...`;
        } else {
            typingDiv.textContent = "";
        }
    });


    //Envia los mensajes del formulario
    // Esta función envía el mensaje escrito en el input al servidor
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

    //  Emitir typing para cualquier chat
    let typingTimeout;
    messageInput.addEventListener("input", () => {
        socket.emit("typing", {
            user: user.name,
            typing: true,
            chatId: activeChat
        });
        // Limpiar el timeout anterior para evitar múltiples emisiones
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit("typing", {
                user: user.name,
                typing: false,
                chatId: activeChat
            });
        }, 1000);
    });

    // Establecer el chat general como activo al cargar la página
    setActiveChat("general", "Chat General");
});
