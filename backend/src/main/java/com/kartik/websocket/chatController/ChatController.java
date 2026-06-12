package com.kartik.websocket.chatController;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessageSendingOperations messagingTemplate;

    @MessageMapping("/chat.send/{roomCode}")
    public void sendMessage(
            @DestinationVariable String roomCode,
            @Payload ChatMessage chatMessage
    ) {
        messagingTemplate.convertAndSend("/topic/" + roomCode, chatMessage);
    }

    @MessageMapping("/chat.register/{roomCode}")
    public void register(
            @DestinationVariable String roomCode,
            @Payload ChatMessage chatMessage,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        // Add username and roomCode in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        headerAccessor.getSessionAttributes().put("roomCode", roomCode);
        messagingTemplate.convertAndSend("/topic/" + roomCode, chatMessage);
    }
}
