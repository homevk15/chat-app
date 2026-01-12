<?php
/*
Plugin Name: Chat App Bubble
Description: Displays a sticky bubble button that toggles a Node.js chat interface.
Version: 1.1
Author: You
*/

add_action('wp_footer', 'chat_app_bubble_button');

function chat_app_bubble_button() {
    $plugin_url = plugin_dir_url(__FILE__);
    $html_path = plugin_dir_path(__FILE__) . 'chatapp.html';

    if (!file_exists($html_path)) {
        echo '<p>chatapp.html file not found in plugin directory.</p>';
        return;
    }

    $html = file_get_contents($html_path);

    // Fix relative paths in src and href
    $html = preg_replace_callback(
        '/(href|src)=["\'](?!https?:\/\/|\/\/|\/)([^"\']+)["\']/i',
        function ($matches) use ($plugin_url) {
            return $matches[1] . '="' . $plugin_url . $matches[2] . '"';
        },
        $html
    );

    ?>
    <style>
        #chat-bubble-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background-color: #28a745;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 6px 18px rgba(0,0,0,0.3);
            transition: transform 0.3s, background-color 0.3s;
        }

        #chat-bubble-button:hover {
            background-color: #218838;
            transform: scale(1.1);
        }

        #chat-bubble-button::after {
            content: attr(title);
            position: absolute;
            bottom: 70px;
            right: 0;
            background: #333;
            color: #fff;
            padding: 5px 10px;
            font-size: 12px;
            border-radius: 4px;
            white-space: nowrap;
            opacity: 0;
            transform: translateY(10px);
            pointer-events: none;
            transition: opacity 0.2s, transform 0.2s;
        }

        #chat-bubble-button:hover::after {
            opacity: 1;
            transform: translateY(0);
        }

       #chat-popup {
    display: none; /* 🔴 ADD THIS LINE */
    flex-direction: column;
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: min(90vw, 400px);
    height: 500px;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #ccc;
    z-index: 9999;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    overflow: hidden;
}




    </style>

    <!-- Button and Popup -->
    <button id="chat-bubble-button" title="Chat">💬</button>
    <div id="chat-popup"><?php echo $html; ?></div>

    <script>
function initChatBubble() {
    const btn = document.getElementById('chat-bubble-button');
    const popup = document.getElementById('chat-popup');

    if (!btn || !popup) return; // make sure elements exist

    // Avoid duplicate listeners
    if (btn.dataset.listenerAttached) return;
    btn.dataset.listenerAttached = "true";

    btn.addEventListener('click', () => {
        if (popup.style.display === 'block') {
            popup.style.display = 'none';
        } else {
            popup.style.display = 'block';
            setTimeout(() => {
                const chatMessages = popup.querySelector('.chat-messages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }, 100);
        }
    });
}

// --- Run once on first load ---
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatBubble);
} else {
    initChatBubble();
}

// --- Run again after Turbo navigation ---
document.addEventListener("turbo:load", initChatBubble);
</script>


    <?php
}
