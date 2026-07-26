# Postman Test Data

Postman file-upload requests require manual local file selection after import.

Suggested local demo files:

- `non-delivery-statement.pdf`
- `delivery-confirmation.pdf`
- `refund-promise.pdf`
- `cancellation-confirmation.pdf`

Supported backend upload MIME types:

- `application/pdf` with `.pdf`
- `image/png` with `.png`
- `image/jpeg` with `.jpg` or `.jpeg`

For backend local multipart upload, first create an upload target with the exact file name, MIME type, and byte size. Then select the matching file in the `file` form-data field on the local upload request.

Do not use real cardholder data, real evidence, card numbers, bank credentials, or production secrets.
