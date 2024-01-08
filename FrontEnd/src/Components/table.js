/* eslint-disable array-callback-return */
import React, {useEffect, useState} from 'react'
import axios from 'axios'
import {Popconfirm, message} from 'antd'
import Pagination from './pagination'
import EditModal from './modal'
import Header from './header'
import {useNavigate} from 'react-router-dom'
import '../scss/table.css'

const DataTable = () => {
  const URL = process.env.REACT_APP_SERVERLESS_URL
  const [tableData, setTableData] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [loading, setLoading] = useState(false)
  const [totalData, setTotalData] = useState()
  const [next, SetNext] = useState()
  const [previous, setPrevious] = useState()
  const [keys, setKeys] = useState([])
  const [modal, setModal] = useState(false)

  const navigate = useNavigate()

  const editKeys = {
    city: '',
    price: '',
    restaurant: '',
    Identifier: '',
  }
  const [values, setValues] = useState(editKeys)

  const getTableData = async () => {
    await axios
      .post(`${URL}/readData`, {
        page: page,
        pageSize: pageSize,
      })
      .then((results) => {
        if (results.data.TotalDataCount > 0) {
          setKeys(Object.keys(results.data.PaginatedData.Items[0]))
          setTableData(results.data.PaginatedData.Items)
          SetNext(results.data.PaginatedData.Next)
          setPrevious(results.data.PaginatedData.Previous)
          setTotalData(results.data.TotalDataCount)
          setLoading(false)
        } else {
          setTotalData(results.data.TotalDataCount)
          setLoading(false)
        }
      })
      .catch((error) => {
        console.log(error)
      })
  }

  const paginate = (pageNumber) => {
    setPage(pageNumber)
  }

  const deleteRecord = async (id) => {
    console.log(id)
    setLoading(true)
    await axios
      .delete(`${URL}/deleteData/${id}`)
      .then((results) => {
        if (results.status === 200) {
          message.open({
            type: 'success',
            content: `Record with ID ${id} deleted`,
            duration: 3,
          })
          getTableData()
        }
      })
      .catch((error) => {
        console.log(error)
        message.open({
          type: 'error',
          content: `Error in Deleting Record with ID ${id}`,
          duration: 10,
        })
      })
  }

  const deleteAllRecord = async () => {
    setLoading(true)
    await axios
      .delete(`${URL}/deleteAll`)
      .then((results) => {
        if (results.status === 200) {
          message.open({
            type: 'success',
            content: 'All the records deleted from DB',
            duration: 3,
          })
          getTableData()
        }
      })
      .catch((error) => {
        console.log(error)
        message.open({
          type: 'error',
          content: 'Error in deleting all records from DB',
          duration: 10,
        })
      })
  }

  const editValues = (val) => {
    setValues({
      city: val.City,
      price: val.Price,
      restaurant: val.Restaurant,
      Identifier: val.Identifier,
    })
    setModal(true)
  }

  useEffect(() => {
    setLoading(true)
    getTableData()
  }, [page])

  return (
    <div>
      <Header />
      <div className="dataTable-container">
        {loading ? (
          <div className="d-flex justify-content-center">
            <div className="spinner-grow text-primary" role="status">
              <span className="sr-only"></span>
            </div>
          </div>
        ) : totalData === 0 ? (
          <div className="loading-table-container">
            <div className="d-flex justify-content-center">
              <div className="spinner-grow text-primary" role="status"></div>
            </div>
            <div className="d-flex justify-content-center">
              <span className="sr-only loading-heading">
                No Data to show in table. Upload a File
              </span>
            </div>
            <div className="table-top-btns-data d-flex justify-content-center">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/home')}
              >
                Go Back
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="table-top-btns">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/home')}
              >
                Go Back
              </button>
              <Popconfirm
                title={`Are you sure to delete all the records ?`}
                onConfirm={() => deleteAllRecord()}
                okText="Yes"
                cancelText="No"
              >
                <button type="button" className="btn btn-danger btn-sm">
                  Delete All
                </button>
              </Popconfirm>
            </div>
            <Pagination
              next={next}
              previous={previous}
              totalDataCount={totalData}
              dataPerPage={pageSize}
              paginate={paginate}
              page={page}
            />
            <table className="table table-striped">
              <thead className="thead-dark" style={{fontWeight: 'bold'}}>
                <tr>
                  <th scope="col">No.</th>
                  {keys.map(
                    (value, index) =>
                      value !== 'FileName' &&
                      value !== 'Address' && (
                        <th scope="col" key={index}>
                          {value}
                        </th>
                      )
                  )}
                </tr>
              </thead>
              <tbody>
                {tableData.map((value, index) => (
                  <tr key={index}>
                    <th scope="col">{(page - 1) * pageSize + index + 1}</th>
                    {keys.map((headerValue, headerIndex) => {
                      return (
                        headerValue !== 'FileName' &&
                        headerValue !== 'Address' && (
                          <td key={headerIndex}>{value[headerValue]}</td>
                        )
                      )
                    })}
                    <td>
                      <div className="action-btns">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => editValues(value)}
                        >
                          Edit
                        </button>
                        <Popconfirm
                          title={`Are you sure to delete this Record ${value.Identifier} ?`}
                          onConfirm={() => deleteRecord(value.Identifier)}
                          // onCancel={cancel}
                          okText="Yes"
                          cancelText="No"
                        >
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </Popconfirm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              next={next}
              previous={previous}
              totalDataCount={totalData}
              dataPerPage={pageSize}
              paginate={paginate}
              page={page}
            />
          </div>
        )}
        {modal ? (
          <EditModal
            visible={modal}
            values={values}
            setVisible={setModal}
            getTableData={getTableData}
            spinner={setLoading}
          />
        ) : null}
      </div>
    </div>
  )
}

export default DataTable
