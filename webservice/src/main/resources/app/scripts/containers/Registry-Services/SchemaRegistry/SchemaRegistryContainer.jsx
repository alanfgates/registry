/**
  * Copyright 2017 Hortonworks.
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *   http://www.apache.org/licenses/LICENSE-2.0
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
**/

import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';
import BaseContainer from '../../BaseContainer';
import {Link} from 'react-router';
import FSModal from '../../../components/FSModal';
import {
    DropdownButton,
    MenuItem,
    FormGroup,
    InputGroup,
    FormControl,
    Button,
    PanelGroup,
    Panel,
    Modal
} from 'react-bootstrap';
import Utils from '../../../utils/Utils';
import ReactCodemirror from 'react-codemirror';
import '../../../utils/Overrides';
import CodeMirror from 'codemirror';
import 'codemirror/mode/javascript/javascript';
import jsonlint from 'jsonlint';
import lint from 'codemirror/addon/lint/lint';
import SchemaInfoForm from './SchemaInfoForm';
import SchemaVersionForm from './SchemaVersionForm';
import FSReactToastr from '../../../components/FSReactToastr';
import SchemaREST from '../../../rest/SchemaREST';
import NoData from '../../../components/NoData';
import {toastOpt} from '../../../utils/Constants';
import CommonNotification from '../../../utils/CommonNotification';

CodeMirror.registerHelper("lint", "json", function(text) {
  var found = [];
  var {parser} = jsonlint;
  parser.parseError = function(str, hash) {
    var loc = hash.loc;
    found.push({
      from: CodeMirror.Pos(loc.first_line - 1, loc.first_column),
      to: CodeMirror.Pos(loc.last_line - 1, loc.last_column),
      message: str
    });
  };
  try {
    jsonlint.parse(text);
  } catch (e) {}
  return found;
});

export default class SchemaRegistryContainer extends Component {
  constructor(props) {
    super();
    this.breadcrumbData = {
      title: 'Schema Registry',
      linkArr: [
        {
          title: 'Registry Service'
        }, {
          title: 'Schema Registry'
        }
      ]
    };

    this.state = {
      modalTitle: '',
      schemaData: [],
      slideInput : false,
      filterValue: '',
      fetchLoader: true,
      sorted : {
        key : 'timestamp',
        text : 'Last Updated'
      },
      expandSchema: false
    };
    this.schemaObj = {};
    this.schemaText = '';
    this.fetchData('timestamp,d'); //keyname,(a => ascending or d=> descending)
  }
  componentDidUpdate(){
    this.btnClassChange();
  }
  componentDidMount(){
    this.btnClassChange();
  }
  btnClassChange = () => {
    if(!this.state.fetchLoader){
      if(this.state.schemaData.length !== 0){
        const sortDropdown = document.querySelector('.sortDropdown');
        sortDropdown.setAttribute("class","sortDropdown");
        sortDropdown.parentElement.setAttribute("class","dropdown");
        if(this.refs.schemaName && this.schemaNameTagWidth != this.refs.schemaName.offsetWidth){
          this.schemaNameTagWidth = this.refs.schemaName.offsetWidth;
          this.schemaGroupTagWidth= this.refs.schemaGroup.offsetWidth;
          this.setState(this.state);
        }
      }
    }
  }
  fetchData(sortBy) {
    let promiseArr = [],
      schemaData = [],
      schemaCount = 0;
    SchemaREST.getAllSchemas(sortBy).then((schema) => {
      if (schema.responseMessage !== undefined) {
        FSReactToastr.error(
          <CommonNotification flag="error" content={schema.responseMessage}/>, '', toastOpt);
      } else {
        let schemaEntities = [];
        schema.entities.map((obj, index) => {
          let {name, schemaGroup, type, description, compatibility, evolve} = obj;
          schemaCount++;
          schemaData.push({
            id: (index + 1),
            type: type,
            compatibility: compatibility,
            schemaName: name,
            schemaGroup: schemaGroup,
            evolve: evolve,
            collapsed: true,
            versionsArr:  [],
            currentVersion: null
          });
          schemaEntities = schemaData;
          this.setState({schemaData: schemaEntities, fetchLoader: (schemaCount == schemaEntities.length ? false : true)});
        });
        if(schema.entities.length === 0) {
          this.setState({fetchLoader: false});
        }
      }
    });
  }
  getIconClass(c) {
    switch(c){
    case 'FORWARD':
      return "fa fa-arrow-right";
    case 'BACKWARD':
      return "fa fa-arrow-left";
    case 'BOTH':
      return "fa fa-exchange";
    case 'NONE':
      return "fa fa-ban";
    default:
      return '';
    }
  }
  getBtnClass(c) {
    switch(c){
    case 'FORWARD':
      return "warning";
    case 'BACKWARD':
      return "backward";
    case 'BOTH':
      return "";
    default:
      return 'default';
    }
  }
  slideInput = (e) => {
    this.setState({slideInput  : true});
    const input = document.querySelector('.inputAnimateIn');
    input.focus();
  }
  slideInputOut = () =>{
    const input = document.querySelector('.inputAnimateIn');
    (_.isEmpty(input.value)) ? this.setState({slideInput  : false}) : '';
  }
  onFilterChange = (e) => {
    this.setState({filterValue: e.target.value.trim()});
  }
  filterSchema(entities, filterValue){
    let matchFilter = new RegExp(filterValue , 'i');
    return entities.filter(e => !filterValue || matchFilter.test(e.schemaName));
  }
  onSortByClicked = (eventKey,el) => {
    const liList = el.target.parentElement.parentElement.children;
    let {schemaData} = this.state;
    for(let i = 0;i < liList.length ; i++){
      liList[i].setAttribute('class','');
    }
    el.target.parentElement.setAttribute("class","active");
    this.setState({fetchLoader: true});
    //if sorting by name, then in ascending order
    //if sorting by timestamp, then in descending order
    this.fetchData(eventKey === 'name' ? eventKey+',a' : eventKey+',d');
    const sortObj = {key : eventKey , text : this.sortByKey(eventKey)};
    this.setState({sorted : sortObj});
  }
  sortByKey = (string) => {
    switch (string) {
    case "timestamp": return "Last Updated";
      break;
    case "name" : return "Name";
      break;
    default: return "Last Updated";
    }
  }
  handleOnEnter(s){
    let versionsArr = [];
    let {schemaData} = this.state;
    let schema = _.find(schemaData,{id: s.id});
    let obj = {};
    SchemaREST.getSchemaVersions(schema.schemaName)
      .then((versionResults)=>{
        let versions = versionResults;
        let latestVersion = Utils.sortArray(versions.entities.slice(), 'timestamp', false)[0];
        versions.entities.map((v) => {
          versionsArr.push({
            versionId: v.version,
            description: v.description,
            schemaText: v.schemaText,
            schemaName: schema.schemaName,
            timestamp: v.timestamp
          });
        });
        schema.versionsArr = versionsArr;
        schema.currentVersion = latestVersion.version;
        obj.schemaData = schemaData;
        s.renderCodemirror = true;
        this.setState(obj);
      });
  }
  handleOnExit(s){
    s.renderCodemirror = false;
    this.setState(this.state);
  }
  handleSelect(s, k, e){
    let {schemaData} = this.state;
    let schema = _.find(schemaData,{id: s.id});
    let obj = {};
    schema.collapsed = !s.collapsed;
    obj.schemaData = schemaData;
    this.setState(obj);
  }
  selectVersion(v) {
    let {schemaData} = this.state;
    let obj = _.find(schemaData, {schemaName: v.schemaName});
    obj.currentVersion = v.versionId;
    this.setState({schemaData: schemaData});
  }
  handleAddSchema() {
    this.setState({
      modalTitle: 'Add New Schema'
    }, () => {
      this.refs.schemaModal.show();
    });
  }
  handleAddVersion(schemaObj) {
    let obj = _.find(schemaObj.versionsArr, {versionId: schemaObj.currentVersion});
    this.schemaObj = {
      schemaName: schemaObj.schemaName,
      description: obj ? obj.description : '',
      schemaText: obj ? obj.schemaText : '',
      versionId: obj ? obj.versionId : ''
    };
    this.setState({
      modalTitle: 'Edit Version'
    }, () => {
      this.refs.versionModal.show();
    });
  }
  handleExpandView(schemaObj) {
    let obj = _.find(schemaObj.versionsArr, {versionId: schemaObj.currentVersion});
    this.schemaText = obj.schemaText;
    this.setState({
      modalTitle: obj.schemaName,
      expandSchema: true
    }, () => {
      this.setState({ expandSchema: true});
    });
  }
  handleSaveVersion() {
    if (this.refs.addVersion.validateData()) {
      this.refs.addVersion.handleSave().then((versions) => {
        if(versions && versions.compatible === false){
          FSReactToastr.error(<CommonNotification flag="error" content="Schema is not compatible with other versions."/>, '', toastOpt);
        } else {
          if (versions.responseMessage !== undefined) {
            FSReactToastr.error(
              <CommonNotification flag="error" content={versions.responseMessage}/>, '', toastOpt);
          } else {
            this.refs.versionModal.hide();
            this.fetchData();
            let msg = "Version added successfully";
            if (this.state.modalTitle === 'Edit Version') {
              msg = "Version updated successfully";
            }
            if(versions === this.schemaObj.versionId) {
              msg = "The schema version is already present";
              FSReactToastr.info(
                <strong>{msg}</strong>
              );
            } else {
              FSReactToastr.success(
                <strong>{msg}</strong>
              );
            }
          }
        }
      });
    }
  }
  handleSave() {
    if (this.refs.addSchema.validateData()) {
      this.refs.addSchema.handleSave().then((schemas) => {
        if (schemas.responseMessage !== undefined) {
          FSReactToastr.error(
            <CommonNotification flag="error" content={schemas.responseMessage}/>, '', toastOpt);
        } else {
          this.refs.schemaModal.hide();
          this.fetchData();
          let msg = "Schema added successfully";
          if (this.state.id) {
            msg = "Schema updated successfully";
          }
          FSReactToastr.success(
            <strong>{msg}</strong>
          );
        }
      });
    }
  }
  render() {
    const jsonoptions = {
      lineNumbers: true,
      mode: "application/json",
      styleActiveLine: true,
      gutters: ["CodeMirror-lint-markers"],
      lint: false,
      readOnly: true,
      theme: 'default no-cursor schema-editor'
    };
    const schemaViewOptions = {
      lineNumbers: true,
      mode: "application/json",
      styleActiveLine: true,
      gutters: ["CodeMirror-lint-markers"],
      lint: false,
      readOnly: true,
      theme: 'default no-cursor schema-editor expand-schema'
    };
    const {filterValue, slideInput, fetchLoader, schemaData} = this.state;
    const sortTitle = <span>Sort:<span className="font-blue-color">&nbsp;{this.state.sorted.text}</span></span>;
    var schemaEntities = schemaData;
    if(filterValue.trim() !== ''){
      schemaEntities = this.filterSchema(schemaData, filterValue);
    }
    return (
      <div>
        <BaseContainer routes={this.props.routes} onLandingPage="false" breadcrumbData={this.breadcrumbData} headerContent={'All Schemas'}>
            <div id="add-schema">
                <button role="button" type="button" className="actionAddSchema hb lg success" onClick={this.handleAddSchema.bind(this)}>
                    <i className="fa fa-plus"></i>
                </button>
            </div>
            {schemaData.length > 0 ?
            (<div className="wrapper animated fadeIn">
              <div className="page-title-box row no-margin">
                  <div className="col-md-3 col-md-offset-6 text-right">
                    <FormGroup>
                       <InputGroup>
                         <FormControl type="text" placeholder="Search by name" onKeyUp={this.onFilterChange} className="" />
                           <InputGroup.Addon>
                             <i className="fa fa-search"></i>
                           </InputGroup.Addon>
                         </InputGroup>
                     </FormGroup>
                  </div>
                  <div className="col-md-2 text-center">
                    <DropdownButton title={sortTitle}
                      id="sortDropdown"
                      className="sortDropdown"
                    >
                        <MenuItem onClick={this.onSortByClicked.bind(this,"name")}>
                            &nbsp;Name
                        </MenuItem>
                        <MenuItem active onClick={this.onSortByClicked.bind(this,"timestamp")}>
                            &nbsp;Last Update
                        </MenuItem>
                    </DropdownButton>
                  </div>
              </div>
            {schemaEntities.length === 0 ? <NoData /> : ''}
            {!fetchLoader ?
            <div className="row">
                <div className="col-md-12">
                    <PanelGroup
                        bsClass="panel-registry"
                        role="tablist"
                    >
                    {schemaEntities.map((s, i)=>{
                      var btnClass = this.getBtnClass(s.compatibility);
                      var iconClass = this.getIconClass(s.compatibility);
                      var versionObj = _.find(s.versionsArr, {versionId: s.currentVersion});
                      var totalVersions = s.versionsArr.length;
                      var sortedVersions =  Utils.sortArray(s.versionsArr.slice(), 'versionId', false);
                      var versionIndex = _.findIndex(sortedVersions, {versionId: s.currentVersion});
                      var header = (
                        <div>
                        <span className={`hb ${btnClass} schema-status-icon`}><i className={iconClass}></i></span>
                        <div className="panel-sections first fluid-width-15">
                            <h4 ref="schemaName" className="schema-name" title={s.schemaName}>{Utils.ellipses(s.schemaName, this.schemaNameTagWidth)}</h4>
                            <p className={`schema-status ${s.compatibility.toLowerCase()}`}>{s.compatibility}</p>
                        </div>
                        <div className="panel-sections">
                            <h6 className="schema-th">Type</h6>
                            <h4 className={`schema-td ${!s.collapsed ? "font-blue-color" : ''}`}>{s.type}</h4>
                        </div>
                        <div className="panel-sections">
                            <h6 className="schema-th">Group</h6>
                            <h4 ref="schemaGroup" className={`schema-td ${!s.collapsed ? "font-blue-color" : ''}`} title={s.schemaGroup}>{Utils.ellipses(s.schemaGroup, this.schemaGroupTagWidth)}</h4>
                        </div>
                        <div className="panel-sections">
                            <h6 className="schema-th">Serializer</h6>
                            <h4 className={`schema-td ${!s.collapsed ? "font-blue-color" : ''}`}>0</h4>
                        </div>
                        <div className="panel-sections">
                            <h6 className="schema-th">Deserializer</h6>
                            <h4 className={`schema-td ${!s.collapsed ? "font-blue-color" : ''}`}>0</h4>
                        </div>
                        <div className="panel-sections" style={{'textAlign': 'right'}}>
                            <a className="collapsed collapseBtn" role="button" aria-expanded="false">
                              <i className={s.collapsed ? "collapseBtn fa fa-chevron-down" : "collapseBtn fa fa-chevron-up"}></i>
                            </a>
                        </div>
                        </div>
                      );
                      return (<Panel
                            header={header}
                            headerRole="tabpanel"
                            key={i}
                            collapsible
                            expanded={s.collapsed ? false : true}
                            onSelect={this.handleSelect.bind(this, s)}
                            onEntered={this.handleOnEnter.bind(this, s)}
                            onExited={this.handleOnExit.bind(this, s)}
                        >
                            {s.collapsed ?
                            '': (versionObj ? (<div className="panel-registry-body">
                                    <div className="row">
                                        <div className="col-sm-3">
                                            <h6 className="schema-th">Description</h6>
                                            <p>{versionObj.description}</p>
                                        </div>
                                        <div className="col-sm-6">
                                            {s.renderCodemirror ?
                                            (s.evolve ? ([<h6 key="e.1" className="version-number-text">VERSION&nbsp;{totalVersions - versionIndex}</h6>,
                                              <button key="e.2" type="button" className="btn btn-link btn-edit-schema" onClick={this.handleAddVersion.bind(this, s)}>
                                                <i className="fa fa-pencil"></i>
                                              </button>,
                                              <button key="e.3" type="button" className="btn btn-link btn-expand-schema" onClick={this.handleExpandView.bind(this, s)}>
                                                <i className="fa fa-arrows-alt"></i>
                                              </button>]) : (<button type="button" className="btn btn-link btn-expand-schema" onClick={this.handleExpandView.bind(this, s)}>
                                              <i className="fa fa-arrows-alt"></i>
                                              </button>))
                                            : ''
                                            }
                                            {s.renderCodemirror ?
                                                (<ReactCodemirror
                                                    ref="JSONCodemirror"
                                                    value={JSON.stringify(JSON.parse(versionObj.schemaText), null, ' ')}
                                                    options={jsonoptions}
                                                />)
                                            : (<div className="col-sm-12">
                                                    <div className="loading-img text-center" style={{marginTop : "50px"}}>
                                                        <img src="styles/img/start-loader.gif" alt="loading" />
                                                    </div>
                                              </div>)
                                            }
                                        </div>
                                <div className="col-sm-3">
                                    <h6 className="schema-th">Change Log</h6>
                                    <ul className="version-tree">
                                        {
                                        sortedVersions.map((v, i)=>{
                                          return (
                                              <li onClick={this.selectVersion.bind(this, v)} className={s.currentVersion === v.versionId? "clearfix current" : "clearfix"} key={i}>
                                              <a className={s.currentVersion === v.versionId? "hb version-number" : "hb default version-number"}>v{totalVersions - i}</a>
                                              <p><span className="log-time-text">{Utils.splitTimeStamp(new Date(v.timestamp))}</span> <br/><span className="text-muted">{i === (totalVersions - 1) ? 'CREATED': 'EDITED'}</span></p>
                                              </li>
                                          );
                                        })
                                      }
                                    </ul>
                                </div>
                            </div>
                    </div>) :
                    (<div className="panel-registry-body">
                      <div className="row">
                        {s.evolve ?
                        ([<div className="col-sm-3" key="v.k.1">
                            <h6 className="schema-th">Description</h6>
                            <p></p>
                        </div>,
                          <div className="col-sm-6" key="v.k.2">
                              {s.renderCodemirror ?
                                <button type="button" className="btn btn-link btn-add-schema" onClick={this.handleAddVersion.bind(this, s)}>
                                <i className="fa fa-pencil"></i>
                                </button>
                                : ''
                              }
                              {s.renderCodemirror ?
                                (<ReactCodemirror
                                  ref="JSONCodemirror"
                                  value=""
                                  options={jsonoptions}
                                />)
                                : (<div className="col-sm-12">
                                    <div className="loading-img text-center" style={{marginTop : "50px"}}>
                                      <img src="styles/img/start-loader.gif" alt="loading" />
                                    </div>
                                </div>)
                              }
                          </div>,
                          <div className="col-sm-3" key="v.k.3">
                            <h6 className="schema-th">Change Log</h6>
                          </div>])
                          : <div style={{'textAlign': 'center'}}>NO DATA FOUND</div>
                        }
                      </div>
                    </div>)
                            )}
                </Panel>
                      );
                    })
        }
        </PanelGroup>
        </div>
    </div>
    : ''}
    </div>)
    : fetchLoader ?
    (
      <div className="col-sm-12">
        <div className="loading-img text-center" style={{marginTop : "50px"}}>
          <img src="styles/img/start-loader.gif" alt="loading" />
        </div>
      </div>
    ): <NoData />
}
        </BaseContainer>

        <FSModal ref="schemaModal" data-title={this.state.modalTitle} data-resolve={this.handleSave.bind(this)}>
          <SchemaInfoForm ref="addSchema"/>
        </FSModal>
        <FSModal ref="versionModal" data-title={this.state.modalTitle} data-resolve={this.handleSaveVersion.bind(this)}>
          <SchemaVersionForm ref="addVersion" schemaObj={this.schemaObj}/>
        </FSModal>
        <Modal dialogClassName="modal-xl" ref="expandSchemaModal" bsSize="large" show={this.state.expandSchema} onHide={()=>{this.setState({ expandSchema: false });}}>
          <Modal.Header closeButton>
            <Modal.Title>{this.state.modalTitle}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {this.state.expandSchema ?
            <ReactCodemirror
              ref="JSONCodemirror"
              value={JSON.stringify(JSON.parse(this.schemaText), null, ' ')}
              options={schemaViewOptions}
            /> : ''}
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={()=>{this.setState({ expandSchema: false });}}>Close</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}
