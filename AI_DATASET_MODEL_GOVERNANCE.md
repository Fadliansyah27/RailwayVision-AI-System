# AI Dataset, Annotation & Model Governance Plan

## 1. Purpose
Define a reproducible, safe process for preparing image/video data, training and evaluating a computer-vision model, and controlling releases.

## 2. Dataset authorization
- Use synthetic/public data for initial engineering demonstration.
- Use KCIC images/videos only after written authorization, data classification, permitted purpose, storage, access, retention, and transfer rules are agreed.
- Do not scrape restricted infrastructure imagery or use personal/passenger imagery without approval.
- Keep dataset lineage, source permission, collection date, capture conditions, and labeling history.

## 3. Defect taxonomy
Do not invent production defect classes. Engineering stakeholders must define:
- Approved asset categories.
- Visual class definitions and exclusions.
- Annotation unit (image, object, frame, region).
- Severity/priority mapping, if any, owned by engineering policy—not AI confidence.
- Ambiguous/uncertain and unobservable labels.
- Escalation and human review rules.

## 4. Annotation quality
- Write an annotation handbook with positive/negative examples.
- Use trained annotators.
- Double-label a representative subset.
- Resolve disagreements with an authorized adjudicator.
- Track annotator, label version, and adjudication.
- Preserve original labels and changes.

## 5. Dataset split
Split by asset/location, capture session, and/or time to avoid near-duplicate leakage across train/validation/test. Keep a locked test set. Document class imbalance, lighting, weather, camera angle, motion blur, occlusion, distance, and image quality.

## 6. Evaluation
Report at minimum:
- Per-class precision, recall, F1.
- Confusion matrix.
- mAP at defined IoU thresholds for detection.
- False positives and false negatives with reviewed examples.
- Performance by capture condition and asset/site where permitted.
- Calibration/threshold analysis where appropriate.
- Inference latency and resource use.

A single aggregate mAP is insufficient. False negatives and out-of-distribution samples require explicit review.

## 7. Model registry and release
Each model release records:
- Model name and semantic version.
- Artifact checksum and provenance.
- Framework/runtime version.
- Dataset version and authorization reference.
- Class-map version.
- Training configuration and code commit.
- Evaluation report.
- Known limitations.
- Reviewer and deployment approval.
- Rollback target.

Never auto-deploy from a training job or user feedback. Deployment requires independent approval.

## 8. Inference output
Store raw class, bounding box, confidence, frame, model version, checksum, timestamp, and input media hash. UI must label confidence as model confidence—not probability of damage, danger, or safety.

## 9. Monitoring and rollback
Monitor job failures, latency, class distribution, confidence distribution, human rejection/reclassification rates, and periodic evaluation on newly approved labeled data. Drift signals trigger investigation, not automatic model updates.
