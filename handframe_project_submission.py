import cv2
import mediapipe as mp
import numpy as np

def main():
    # Initialize MediaPipe Hands
    mp_hands = mp.solutions.hands
    mp_drawing = mp.solutions.drawing_utils
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    # Initialize Webcam Capture
    cap = cv2.VideoCapture(0)

    print("Starting HandFrame Python Implementation...")
    print("Press 'q' to quit.")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("Ignoring empty camera frame.")
            continue

        # Flip horizontally for a selfie-view display
        frame = cv2.flip(frame, 1)
        h, w, c = frame.shape

        # Convert BGR image to RGB for MediaPipe processing
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb_frame)

        p1, p2, p3, p4 = None, None, None, None

        if results.multi_hand_landmarks and results.multi_handedness:
            # Match detected hands to left vs right
            for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
                label = handedness.classification[0].label  # 'Left' or 'Right'
                
                # Note: MediaPipe hand labeling is inverted for selfie view unless specified
                index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
                thumb_tip = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP]

                index_pt = (int(index_tip.x * w), int(index_tip.y * h))
                thumb_pt = (int(thumb_tip.x * w), int(thumb_tip.y * h))

                if label == 'Left':
                    p1 = index_pt  # Left Index Tip
                    p4 = thumb_pt  # Left Thumb Tip
                elif label == 'Right':
                    p2 = index_pt  # Right Index Tip
                    p3 = thumb_pt  # Right Thumb Tip

                # Optional: draw full hand skeleton for debugging
                mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

        # If all 4 key points are detected, apply perspective wrap filter inside quadrilateral
        if p1 is not None and p2 is not None and p3 is not None and p4 is not None:
            pts_src = np.array([p1, p2, p3, p4], dtype=np.float32)

            # Define output bounding box dimensions
            dst_w = 400
            dst_h = 300
            pts_dst = np.array([
                [0, 0],
                [dst_w - 1, 0],
                [dst_w - 1, dst_h - 1],
                [0, dst_h - 1]
            ], dtype=np.float32)

            # Compute perspective matrix
            M = cv2.getPerspectiveTransform(pts_src, pts_dst)
            warped = cv2.warpPerspective(frame, M, (dst_w, dst_h))

            # Apply sample visual filter (e.g., Grayscale / Edge detection filter inside frame)
            filtered_patch = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
            filtered_patch = cv2.applyColorMap(filtered_patch, cv2.COLORMAP_JET)

            # Warp filtered patch back into frame polygon
            M_inv = cv2.getPerspectiveTransform(pts_dst, pts_src)
            inv_warped = cv2.warpPerspective(filtered_patch, M_inv, (w, h))

            # Mask quadrilateral area
            mask = np.zeros((h, w), dtype=np.uint8)
            poly_pts = np.array([p1, p2, p3, p4], dtype=np.int32)
            cv2.fillPoly(mask, [poly_pts], 255)

            # Combine filtered ROI with background frame
            inv_mask = cv2.bitwise_not(mask)
            bg = cv2.bitwise_and(frame, frame, mask=inv_mask)
            fg = cv2.bitwise_and(inv_warped, inv_warped, mask=mask)
            frame = cv2.add(bg, fg)

            # Draw outer framing line connecting landmarks
            cv2.polylines(frame, [poly_pts], isClosed=True, color=(0, 255, 0), thickness=2)

        cv2.imshow('HandFrame OpenCV Python Implementation', frame)

        if cv2.waitKey(5) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
