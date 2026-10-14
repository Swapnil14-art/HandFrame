import cv2
import mediapipe as mp
import numpy as np

def main():
    # Initialize MediaPipe Hands (open-source cross-platform framework for running real-time, on-device machine learning and computer vision pipelines)
    mp_hands = mp.solutions.hands
    mp_drawing = mp.solutions.drawing_utils
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    # 2. Open default webcam (device index 0) for real-time video capture
    cap = cv2.VideoCapture(0)

    print("Starting HandFrame Python Implementation...")
    print("Press 'q' to quit.")

    while cap.isOpened():
        # Read the latest video frame from the webcam feed
        ret, frame = cap.read()
        if not ret:
            print("Ignoring empty camera frame.")
            continue

        # Flip frame horizontally to create a mirror (selfie-view) experience for natural user interaction
        frame = cv2.flip(frame, 1)
        h, w, c = frame.shape

        # MediaPipe requires RGB color format, whereas OpenCV captures frames in BGR format
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb_frame)

        # Initialize the 4 vertices of the quadrilateral: Left/Right Index and Thumb tips
        p1, p2, p3, p4 = None, None, None, None

        if results.multi_hand_landmarks and results.multi_handedness:
            # Iterate through each detected hand and classify it as Left or Right
            for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
                label = handedness.classification[0].label  # 'Left' or 'Right'
                
                # Extract normalized fingertip landmarks: landmark 8 is index tip, landmark 4 is thumb tip
                index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
                thumb_tip = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP]

                # Convert normalized coordinates [0.0, 1.0] to actual frame pixel coordinates
                index_pt = (int(index_tip.x * w), int(index_tip.y * h))
                thumb_pt = (int(thumb_tip.x * w), int(thumb_tip.y * h))

                # Assign fingertips according to hand orientation to form the quadrilateral vertices
                if label == 'Left':
                    p1 = index_pt  # Left Index Tip
                    p4 = thumb_pt  # Left Thumb Tip
                elif label == 'Right':
                    p2 = index_pt  # Right Index Tip
                    p3 = thumb_pt  # Right Thumb Tip

                # Draw hand landmarks and bone connection lines for visual tracking feedback
                mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

        # Apply regional filter when all four physical fingertips (p1, p2, p3, p4) are tracked
        if p1 is not None and p2 is not None and p3 is not None and p4 is not None:
            # Source polygon defined by the four fingertip pixel coordinates
            pts_src = np.array([p1, p2, p3, p4], dtype=np.float32)

            # Target rectangle dimensions for planar perspective rectification
            dst_w = 400
            dst_h = 300
            pts_dst = np.array([
                [0, 0],
                [dst_w - 1, 0],
                [dst_w - 1, dst_h - 1],
                [0, dst_h - 1]
            ], dtype=np.float32)

            # Compute homography matrix to rectify the irregular hand quadrilateral into a flat rectangle
            M = cv2.getPerspectiveTransform(pts_src, pts_dst)
            warped = cv2.warpPerspective(frame, M, (dst_w, dst_h))

            # Apply visual filter to rectified patch: convert to grayscale then apply JET thermal colormap
            filtered_patch = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
            filtered_patch = cv2.applyColorMap(filtered_patch, cv2.COLORMAP_JET)

            # Compute inverse perspective transform to warp the filtered patch back into the hand frame quadrilateral
            M_inv = cv2.getPerspectiveTransform(pts_dst, pts_src)
            inv_warped = cv2.warpPerspective(filtered_patch, M_inv, (w, h))

            # Create binary mask for the quadrilateral region to isolate filtered pixels from background
            mask = np.zeros((h, w), dtype=np.uint8)
            poly_pts = np.array([p1, p2, p3, p4], dtype=np.int32)
            cv2.fillPoly(mask, [poly_pts], 255)

            # Combine untouched background outside the polygon with the filtered interior using bitwise blending
            inv_mask = cv2.bitwise_not(mask)
            bg = cv2.bitwise_and(frame, frame, mask=inv_mask)
            fg = cv2.bitwise_and(inv_warped, inv_warped, mask=mask)
            frame = cv2.add(bg, fg)

            # Draw green bounding border along the perimeter of the user's hand frame
            cv2.polylines(frame, [poly_pts], isClosed=True, color=(0, 255, 0), thickness=2)

        # Render processed output frame in an interactive OpenCV window
        cv2.imshow('HandFrame OpenCV Python Implementation', frame)

        # Poll keyboard input: exit execution loop when 'q' key is pressed
        if cv2.waitKey(5) & 0xFF == ord('q'):
            break

    # Release webcam hardware and destroy any open GUI display windows
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
