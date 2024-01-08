const AWS = require('aws-sdk')
const XLSX = require('xlsx')

const awsRegion = process.env.REGION
AWS.config.update({
  region: awsRegion,
})

const s3 = new AWS.S3({signatureVersion: 'v4'})
const documentClient = new AWS.DynamoDB.DocumentClient({region: awsRegion})

module.exports.createSignedUrl = async (event, context, callback) => {
  console.log('Create Signed URL Event Trigger :- ', event)

  const bucketName = process.env.BUCKET_NAME
  const requestObject = JSON.parse(event['body'])

  const dateTime = new Date().valueOf()
  const fileName = dateTime + requestObject.fileName

  const params = {
    Bucket: bucketName,
    Fields: {
      key: fileName,
    },
    Expires: 1800,
  }

  try {
    await s3.createPresignedPost(params, (error, data) => {
      if (error) {
        console.log('Error in Creating SignedURL', error)
        const response = {
          statusCode: 500,
          body: JSON.stringify({
            message: 'Error in creating preSignedPostURL',
            Error: error,
          }),
        }
        callback(null, response)
      }
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Signed URL created Successfully',
          URL: data,
        }),
      }
      callback(null, response)
    })
  } catch (error) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error in creating SignedURL',
        Error: error,
      }),
    }
    callback(null, response)
  }
}

module.exports.migrateDataToDynamoDb = async (event, context, callback) => {
  console.log('Migrate Event Trigger :- ', event)
  console.log('Uploaded File Details', event.Records[0].s3)

  const bucketName = event.Records[0].s3.bucket.name
  const fileName = event.Records[0].s3.object.key
  const tableName = process.env.TABLE_NAME

  const extension = fileName.split('.').pop()
  console.log('Extension of File :-', extension)

  console.log(
    'Bucket Name :-',
    bucketName,
    'File Name :-',
    fileName,
    'Table Name :-',
    tableName,
    'Region :-',
    awsRegion
  )
  //CONVERT CSV TO JSON FUNCTION
  const stringToJSON = (csv) => {
    //find number of lines
    var lines = csv.split('\r')
    console.log('Total lines :-', lines.length)

    //delete all spaces
    // for (var i = 0; i < lines.length; i++) {
    //   lines[i] = lines[i].replace(/\s/, '')
    // }
    var result = []
    //finding column names or headers
    var headers = lines[0].split(',')

    for (var i = 1; i < lines.length; i++) {
      var obj = {}
      var currentLine = lines[i].split(',')
      for (var j = 0; j < headers.length; j++) {
        //removing if the object key has no value
        if (currentLine[j] !== '') {
          obj[headers[j].toString()] = currentLine[j]
          obj['Identifier'] = 'Id-' + i.toString()
        }
      }
      result.push(obj)
    }
    return result
  }

  s3.getObject(
    {
      Bucket: bucketName,
      Key: fileName,
    },
    async (error, value) => {
      console.log('Received Value :-', value)
      if (error) {
        const response = {
          statusCode: 500,
          body: JSON.stringify({
            message: 'Error in getting Objects from S3 Bucket',
            error: error,
          }),
        }
        callback(null, response)
      }
      if (extension === 'csv') {
        console.log('CSV file Migration on progress')
        let jsonValuesCsv = []
        var fileData = value.Body.toString('utf-8')
        jsonValuesCsv = stringToJSON(fileData)
        console.log('No. of data from CSV :- ', jsonValuesCsv.length)
        for (var i = 0; i < jsonValuesCsv.length; i++) {
          try {
            var params = {
              TableName: tableName,
              Item: {
                FileName: fileName,
                ...jsonValuesCsv[i],
              },
            }
            const result = await documentClient.put(params).promise()
            console.log('DB update success - CSV :-', result)
            const response = {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Data Updated to DynamoDB',
              }),
            }
            callback(null, response)
          } catch (error) {
            if (error) {
              console.log('Error in Updating to DB :-', error)
              const response = {
                statusCode: 500,
                body: JSON.stringify({
                  message: 'Error in Updating to DynamoDB',
                  error: error,
                }),
              }
              callback(null, response)
            }
          }
        }
      } else if (extension === 'xlsx') {
        console.log('XLSX file Migration')
        let jsonValuesXlsx = []

        var workBook = XLSX.read(value.Body, {
          dateNF: 'mm/dd/yyyy',
        })
        var sheetName = workBook.SheetNames

        sheetName.forEach(async (y) => {
          const ws = workBook.Sheets[y]
          const values = XLSX.utils.sheet_to_json(ws, {raw: false})
          values.map((v) => {
            jsonValuesXlsx.push(v)
          })
        })
        console.log('Data from XLSX :- ', jsonValuesXlsx[0])
        for (var i = 0; i < jsonValuesXlsx.length; i++) {
          var params = {
            TableName: tableName,
            Item: {
              FileName: fileName,
              ...jsonValuesXlsx[i],
            },
          }
          try {
            const results = await documentClient.put(params).promise()
            console.log('DB update success - XLSX:-', results)
            const response = {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Data Updated to DynamoDB',
                error: null,
              }),
            }
            callback(null, response)
          } catch (error) {
            console.log('Error in Updating to DB :-', error)
            const response = {
              statusCode: 500,
              body: JSON.stringify({
                message: 'Error in Updating to DynamoDB',
                error: error,
              }),
            }
            callback(null, response)
          }
        }
      }
    }
  )

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'File Uploaded',
    }),
  }
  callback(null, response)
}

module.exports.readFromDynamoDB = async (event, context, callback) => {
  console.log('Read Event Trigger :- ', event)

  const requestObject = JSON.parse(event['body'])
  const page = requestObject.page
  const pageSize = requestObject.pageSize

  const tableName = process.env.TABLE_NAME

  console.log(
    'Table Name :-',
    tableName,
    'page :-',
    page,
    'pageSize :-',
    pageSize
  )

  let params = {
    TableName: tableName,
  }
  let dbData = []
  let values = {}
  let results

  do {
    results = await documentClient.scan(params).promise()
    console.log('Results from Scan :-', results)

    results.Items.forEach((value) => dbData.push(value))
    params.ExclusiveStartKey = results.LastEvaluatedKey
  } while (typeof results.LastEvaluatedKey !== 'undefined')

  values['Item'] = dbData

  console.log('Retrived Data :-', dbData)
  console.log('Retrived Data Object :-', values)
  console.log('Retrived Data Size :-', dbData.length)

  const pagination = (model, page, size) => {
    const startIndex = (page - 1) * size
    const endIndex = page * size

    const values = {}

    if (endIndex < dbData.length) {
      values.Next = {
        Page: page + 1,
        Size: pageSize,
      }
    }

    if (startIndex > 0) {
      values.Previous = {
        Page: page - 1,
        Size: pageSize,
      }
    }

    values.Items = model.slice(startIndex, endIndex)

    return values
  }

  const paginationResults = pagination(dbData, page, pageSize)

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      Message: 'Data received from DynamoDB',
      TotalDataCount: dbData.length,
      PaginatedDataCount: paginationResults.Items.length,
      PaginatedData: paginationResults,
    }),
  }

  callback(null, response)
}

module.exports.updateDynamoDbData = async (event, context, callback) => {
  console.log('Update Event Trigger :- ', event)

  const requestObject = JSON.parse(event['body'])
  const tableName = process.env.TABLE_NAME
  const updateId = event.pathParameters.id
  const price = requestObject.price
  const city = requestObject.city
  const restaurant = requestObject.restaurant

  console.log(
    'Table Name :-',
    tableName,
    'Update ID :-',
    updateId,
    'Price :-',
    price,
    'City :-',
    city,
    'Restaurant :-',
    restaurant
  )

  if (price === undefined || city === undefined || restaurant === undefined) {
    const response = {
      statusCode: 404,
      body: JSON.stringify({
        Message: `Updating Data with ID ${updateId} is missing parameters`,
      }),
    }
    callback(null, response)
  } else {
    const params = {
      TableName: tableName,
      Key: {
        Identifier: updateId,
      },
      UpdateExpression:
        'set #city = :city, #price = :price, #restaurant = :restaurant',
      ExpressionAttributeNames: {
        '#city': 'City',
        '#price': 'Price',
        '#restaurant': 'Restaurant',
      },
      ExpressionAttributeValues: {
        ':city': city,
        ':price': price,
        ':restaurant': restaurant,
      },
      ReturnValues: 'UPDATED_NEW',
    }
    try {
      const updatedResults = await documentClient.update(params).promise()
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          Message: `Data with ID ${updateId} successfully Updated with the new given values`,
          Results: updatedResults,
        }),
      }
      console.log('Updated Results :-', updatedResults)
      callback(null, response)
    } catch (error) {
      const response = {
        statusCode: 400,
        body: JSON.stringify({
          Message: `Error in Updating Data with ID ${updateId}`,
          Error: error,
        }),
      }
      console.log('Error in Updating :-', error)
      callback(null, response)
    }
  }
}

module.exports.deleteDynamoDbData = async (event, context, callback) => {
  console.log('Delete Event Trigger :- ', event)

  const tableName = process.env.TABLE_NAME
  const deletionId = event.pathParameters.id

  console.log('Table Name :-', tableName, 'Deletion ID :-', deletionId)

  const params = {
    TableName: tableName,
    Key: {
      Identifier: deletionId,
    },
  }

  try {
    const deletedResult = await documentClient.delete(params).promise()
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        Message: `Data with ID ${deletionId} successfully deleted`,
        Results: deletedResult,
      }),
    }
    console.log('Deletion Success :-', deletedResult)
    callback(null, response)
  } catch (error) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        Message: `Error in Deleting Data with ID ${deletionId}`,
        Error: error,
      }),
    }
    console.log('Error in Deleting Data :-', error)
    callback(null, response)
  }
}

module.exports.writeDynamoDbDataToFile = async (event, context, callback) => {
  console.log('Write DB data to File Event Trigger :-', event)

  const bucketName = process.env.BUCKET_NAME
  const tableName = process.env.TABLE_NAME

  console.log('Table Name :-', tableName, 'Bucket Name :-', bucketName)

  let params = {
    TableName: tableName,
  }
  let dbData = []
  let results

  do {
    results = await documentClient.scan(params).promise()
    console.log('Results from Scan :-', results)

    results.Items.forEach((value) => dbData.push(value))
    params.ExclusiveStartKey = results.LastEvaluatedKey
  } while (typeof results.LastEvaluatedKey !== 'undefined')

  console.log('Retrived Data :-', dbData)
  console.log('Retrived Data Size :-', dbData.length)

  var workbook = XLSX.utils.book_new()
  const headers = Object.keys(dbData[0])
  console.log('Key Values :- ', headers)

  var worksheet = XLSX.utils.json_to_sheet(dbData, headers)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'sheet 1')
  const file = await XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    bookSST: false,
  })

  const dateTime = new Date().valueOf()

  var values = {
    Bucket: bucketName,
    Key: `${dateTime}file.xlsx`,
    Body: file,
    ContentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ContentEncoding: 'base64',
  }

  const signedUrlExpireSeconds = 60 * 5
  const getObjectParams = {
    Bucket: bucketName,
    Key: `${dateTime}file.xlsx`,
    Expires: signedUrlExpireSeconds,
  }

  try {
    const result = await s3.upload(values).promise()
    const downloadSignedUrl = await s3.getSignedUrl(
      'getObject',
      getObjectParams
    )
    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        Message: 'Data from DynamoDB Exported to Excel and URL is created',
        Data: result,
        URL: downloadSignedUrl,
      }),
    }
    console.log(
      'Data from DynamoDB Exported to Excel',
      result,
      'URL created',
      downloadSignedUrl
    )
    callback(null, response)
  } catch (error) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        Message: 'Error in Uploading Excel file to Bucket or in creating URL',
        Error: error,
      }),
    }
    console.log(
      'Error in Uploading Excel file to Bucket or in creating URL',
      error
    )
    callback(null, response)
  }
}

module.exports.deleteAllData = async (event, context, callback) => {
  console.log('Delete Event Trigger :- ', event)

  const tableName = process.env.TABLE_NAME

  console.log('Table Name :-', tableName)

  try {
    let lastEvaluatedKey = null
    do {
      const params = {
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      }

      const data = await documentClient.scan(params).promise()
      const itemsToDelete = data.Items

      await Promise.all(
        itemsToDelete.map((item) =>
          documentClient
            .delete({
              TableName: tableName,
              Key: {
                Identifier: item.Identifier,
              },
            })
            .promise()
        )
      )

      lastEvaluatedKey = data.LastEvaluatedKey
    } while (typeof lastEvaluatedKey !== 'undefined')

    console.log('All items deleted from table:', tableName)
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        Message: 'Data removed from DB',
      }),
    }
    console.log('Deletion Success')
    callback(null, response)
  } catch (error) {
    console.error('Error deleting items:', error)
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        Message: 'Error in Deleting Data in DB',
        Error: error,
      }),
    }
    console.log('Error in Deleting all Data from DB :-', error)
    callback(null, response)
  }
}
