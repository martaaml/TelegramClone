document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const avatarInput = document.getElementById("avatarFile");
    const avatarOptions = document.querySelectorAll(".avatar-option");
    let selectedAvatar = null;

    avatarOptions.forEach(option => {
        option.addEventListener("click", () => {
            avatarOptions.forEach(o => o.classList.remove("selected"));
            option.classList.add("selected");
            selectedAvatar = option.dataset.avatar;
        });
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const status = document.getElementById("status").value.trim();
        const file = avatarInput.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const avatarData = reader.result;
                const user = { name, status, avatar: avatarData };
                localStorage.setItem("userData", JSON.stringify(user));
                window.location.href = "/chat.html";
            };
            reader.readAsDataURL(file);
        } else if (selectedAvatar) {
            const user = { name, status, avatar: selectedAvatar };
            localStorage.setItem("userData", JSON.stringify(user));
            window.location.href = "/chat.html";
        } else {
            alert("Por favor selecciona un avatar o sube una imagen.");
        }
    });
});